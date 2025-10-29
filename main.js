import { Actor, log } from "apify";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

async function fetchHtml(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "SmartContractorCrawler/1.0" },
    });
    const text = await res.text();
    clearTimeout(timer);
    return { html: text, ok: res.ok, url: res.url, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function extractText($) {
  const main = $("main,[role='main'],article,.content,#content");
  return (main.length ? main.text() : $("body").text()).replace(/\s+/g, " ").trim();
}

await Actor.init();

const input = await Actor.getInput();
const startUrls = input?.startUrls || [];
const concurrency = input?.maxConcurrency || 20;

if (!startUrls.length) {
  log.error("No URLs provided!");
  await Actor.exit();
}

let counter = 0;
log.info(`Starting crawl of ${startUrls.length} URLs…`);

const limit = concurrency;
const queue = [...new Set(startUrls.map((u) => (typeof u === "string" ? u : u.url)))];
let active = 0;

async function runNext() {
  if (!queue.length) return;
  while (active < limit && queue.length) {
    const url = queue.shift();
    active++;
    process(url)
      .then(() => {
        active--;
        runNext();
      })
      .catch(() => {
        active--;
        runNext();
      });
  }
}

async function process(url) {
  const start = Date.now();
  try {
    const { html, url: finalUrl, status } = await fetchHtml(url);
    const $ = cheerio.load(html);
    const text = extractText($);
    const title = $("title").text().trim();
    const domain = new URL(finalUrl).hostname.replace("www.", "");
    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    await Actor.pushData({
      domain,
      title,
      description,
      text: text.slice(0, 100000),
      status,
      durationMs: Date.now() - start,
    });

    counter++;
    if (counter % 50 === 0) log.info(`${counter} pages processed…`);
  } catch (err) {
    await Actor.pushData({ url, error: err.message });
  }
}

await runNext();

// Wait for all to finish
while (active > 0) {
  await new Promise((r) => setTimeout(r, 500));
}

log.info("✅ All done! Export dataset as CSV or JSON.");
await Actor.exit();
