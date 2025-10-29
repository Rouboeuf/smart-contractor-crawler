import { Actor } from 'apify';
import axios from 'axios';
import * as cheerio from 'cheerio';

// ✅ Ignore SSL certificate errors (expired, self-signed, or invalid)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

await Actor.init();

const input = await Actor.getInput() || {
    startUrls: ["https://example.com"]
};

// --- Utility: validate real business sites ---
function isValidBusinessPage(html, text) {
    if (!html || html.length < 500 || !text || text.length < 100) return false;

    const lower = text.toLowerCase();
    const spamIndicators = [
        "domain for sale", "buy this domain", "godaddy", "namecheap",
        "parking page", "website coming soon", "not found", "404",
        "this domain is available", "search for domains", "suspended page"
    ];
    return !spamIndicators.some(keyword => lower.includes(keyword));
}

// --- Function to scrape one page ---
async function scrapePage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 20000,
        });

        const html = response.data;
        const $ = cheerio.load(html);
        $('script, style, noscript, iframe').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const title = $('title').text().trim();
        const emails = [...new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g))];
        const phones = [...new Set(html.match(/\+?\d[\d\s().-]{8,}\d/g))];

        // Validate real page
        const valid = isValidBusinessPage(html, text);

        return { url, html, text, title, emails, phones, valid };
    } catch (err) {
        console.error(`❌ Error scraping ${url}: ${err.message}`);
        return null;
    }
}

// --- Function to scrape homepage + subpages ---
async function scrapeCompany(baseUrl) {
    const base = new URL(baseUrl).origin;
    const mainPage = await scrapePage(baseUrl);
    if (!mainPage || !mainPage.valid) {
        console.log(`⚠️ Skipping ${baseUrl} (invalid or parked domain)`);
        return;
    }

    const allText = [mainPage.text];
    const allHtml = [mainPage.html];
    const uniqueEmails = new Set(mainPage.emails || []);
    const uniquePhones = new Set(mainPage.phones || []);

    // Find relevant internal pages
    let subpages = [];
    try {
        const response = await axios.get(baseUrl, { timeout: 20000 });
        const $ = cheerio.load(response.data);
        subpages = $('a[href]')
            .map((i, el) => $(el).attr('href'))
            .get()
            .filter(href =>
                href &&
                !href.startsWith('#') &&
                !href.startsWith('mailto:') &&
                !href.includes('.pdf') &&
                !href.includes('wp-') &&
                (href.includes('about') ||
                 href.includes('service') ||
                 href.includes('contact') ||
                 href.includes('project') ||
                 href.includes('gallery') ||
                 href.includes('team'))
            )
            .map(href =>
                href.startsWith('http')
                    ? href
                    : `${base}${href.startsWith('/') ? href : '/' + href}`
            )
            .slice(0, 3);
    } catch (err) {
        console.log(`⚠️ Could not extract subpages for ${baseUrl}: ${err.message}`);
    }

    // Scrape up to 3 subpages
    for (const link of subpages) {
        const sub = await scrapePage(link);
        if (sub && sub.valid) {
            allText.push(sub.text);
            (sub.emails || []).forEach(e => uniqueEmails.add(e));
            (sub.phones || []).forEach(p => uniquePhones.add(p));
        }
    }

    // Merge text & output
    const combinedText = allText.join(' ').replace(/\s+/g, ' ').trim();

    const result = {
        company_url: baseUrl,
        title: mainPage.title,
        html: mainPage.html,
        text: combinedText,
        emails: [...uniqueEmails],
        phones: [...uniquePhones],
        subpages_scraped: subpages.length,
        status: 'scraped_ok',
    };

    await Actor.pushData(result);
    console.log(`✅ Scraped ${baseUrl} (${subpages.length} extra pages)`);
}

// --- Run for all start URLs ---
for (const url of input.startUrls) {
    await scrapeCompany(url);
}

await Actor.exit();
