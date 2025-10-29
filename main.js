import { Actor, log } from 'apify';
import axios from 'axios';
import * as cheerio from 'cheerio';
import http from 'node:http';
import https from 'node:https';

// ---- Global: allow invalid certs but keep it scoped via agent (safer than env var) ----
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
const httpAgent  = new http.Agent({  keepAlive: true });

const AXIOS_DEFAULTS = {
  timeout: 25000,
  maxRedirects: 5,
  decompress: true,
  validateStatus: (s) => s >= 200 && s < 400,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
};

// ----------------------- helpers -----------------------
const normalizeUrl = (u) => {
  let s = String(u).trim();
  if (!s) return null;

  // remove spaces, ensure hostname
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    // normalize trailing slashes etc.
    const url = new URL(s);
    // drop anchors
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

// Try https -> http fallback. Also return origin for building absolute links.
async function fetchWithFallback(raw) {
  // If caller passed http or https explicitly, respect it but still fallback to the other.
  const preferHttps = !/^http:\/\//i.test(raw);

  const urls = preferHttps ? [raw, raw.replace(/^https:\/\//i, 'http://')] :
                             [raw, raw.replace(/^http:\/\//i, 'https://')];

  let lastErr;
  for (const url of urls) {
    try {
      const isHttps = url.startsWith('https://');
      const res = await axios.get(url, {
        ...AXIOS_DEFAULTS,
        httpAgent,
        httpsAgent,
      });
      const finalUrl = res.request?.res?.responseUrl || url;
      const origin = new URL(finalUrl).origin;
      return { url: finalUrl, origin, html: String(res.data || '') };
    } catch (e) {
      lastErr = e;
      log.warning(`Fetch failed ${url}: ${e.message}`);
    }
  }
  throw lastErr || new Error('Unknown fetch error');
}

// far safer parked/invalid heuristic (very loose)
function isProbablyParked(html, text) {
  if (!html || html.length < 200) return true; // almost empty
  const t = (text || '').toLowerCase();

  // if site actually shows real business cues, consider valid
  const hasBusinessCues =
    /contact|services|service|about|gallery|projects|estimate|quote|testimonials|our team|call\s*\(?\d/i.test(t);

  // parking/registrar cues
  const parkedCues =
    /buy this domain|domain for sale|this domain is available|sedo|godaddy|namecheap|parking|coming soon/i.test(t);

  if (parkedCues && !hasBusinessCues) return true;
  return false;
}

function extractTextAndMeta(html) {
  const $ = cheerio.load(html, { decodeEntities: true });
  $('script,style,noscript,iframe,svg,canvas').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const title = ($('title').first().text() || '').trim();
  const emails = [...new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))];
  const phones = [
    ...new Set((text.match(/\+?\d[\d\s().-]{8,}\d/g) || []).map((p) => p.trim())),
  ];
  return { $, text, title, emails, phones };
}

function absolutizeHref(href, origin) {
  if (!href) return null;
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return null;
  if (href.startsWith('javascript:')) return null;
  try {
    if (/^https?:\/\//i.test(href)) {
      const u = new URL(href);
      return u.origin === origin ? u.toString() : null; // keep internal only
    }
    const u = new URL(href.startsWith('/') ? href : `/${href}`, origin);
    return u.toString();
  } catch {
    return null;
  }
}

// ----------------------- page scraping -----------------------
async function scrapePage(url) {
  const { url: finalUrl, origin, html } = await fetchWithFallback(url);
  const { $, text, title, emails, phones } = extractTextAndMeta(html);

  const parked = isProbablyParked(html, text);
  return {
    finalUrl,
    origin,
    html,
    text,
    title,
    emails,
    phones,
    parked,
    $,
  };
}

function pickRelevantInternalLinks($, origin, max = 3) {
  const wanted = ['about', 'service', 'services', 'contact', 'gallery', 'project', 'projects', 'team'];
  const links = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const abs = absolutizeHref(href, origin);
    if (!abs) return;
    const low = abs.toLowerCase();
    if (wanted.some((w) => low.includes(`/${w}`))) links.add(abs);
  });

  return [...links].slice(0, max);
}

// ----------------------- main flow -----------------------
await Actor.init();

const input = (await Actor.getInput()) || {};
const startUrls = (input.startUrls || []).map(normalizeUrl).filter(Boolean);

if (!startUrls.length) {
  log.warning('No startUrls provided. Add them in Actor input.');
}

for (const start of startUrls) {
  try {
    const home = await scrapePage(start);

    if (home.parked) {
      // STILL try to continue: some “minimal” sites look small but are real.
      log.warning(`"${start}" looks minimal/parked. Continuing cautiously...`);
    }

    // find up to 3 relevant internal pages
    const subLinks = pickRelevantInternalLinks(home.$, home.origin, 3);

    const gatheredTexts = [home.text];
    const gatheredHtml = [home.html];
    const emails = new Set(home.emails || []);
    const phones = new Set(home.phones || []);

    for (const link of subLinks) {
      try {
        const sub = await scrapePage(link);
        if (!sub.parked) {
          gatheredTexts.push(sub.text);
          gatheredHtml.push(`<!-- ${link} -->\n${sub.html}`);
          (sub.emails || []).forEach((e) => emails.add(e));
          (sub.phones || []).forEach((p) => phones.add(p));
        }
      } catch (e) {
        log.warning(`Subpage failed ${link}: ${e.message}`);
      }
    }

    const combinedText = gatheredTexts.join(' ').replace(/\s+/g, ' ').trim();
    const combinedHtml = gatheredHtml.join('\n\n');

    await Actor.pushData({
      company_url: start,
      title: home.title,
      html: combinedHtml,           // full HTML: home + subpages (annotated)
      text: combinedText,           // combined clean text
      emails: [...emails],
      phones: [...phones],
      subpages_scraped: subLinks.length,
      status: 'ok',
    });

    log.info(`✅ Scraped ${start} (+${subLinks.length} subpages)`);

  } catch (e) {
    log.error(`❌ Failed ${start}: ${e.message}`);
    await Actor.pushData({
      company_url: start,
      status: 'error',
      error: e.message,
    });
  }
}

await Actor.exit();
