import { Actor } from 'apify';
import axios from 'axios';
import * as cheerio from 'cheerio';

await Actor.init();

const input = await Actor.getInput() || {
    startUrls: ["https://example.com"]
};

const visited = new Set();
const results = [];

// Helper to fetch and extract text + html
async function scrapePage(url) {
    if (visited.has(url)) return;
    visited.add(url);

    console.log(`🕷 Scraping: ${url}`);
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove script/style/meta tags
    $('script, style, noscript, meta, iframe').remove();

    const cleanText = $('body').text()
        .replace(/\s+/g, ' ')
        .replace(/<!--.*?-->/g, '')
        .trim();

    // Extract contact info
    const emails = [...new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g))];
    const phones = [...new Set(html.match(/\+?\d[\d\s().-]{8,}\d/g))];

    return { url, title: $('title').text().trim(), html, text: cleanText, emails, phones };
}

// Crawl home + key subpages
for (const startUrl of input.startUrls) {
    try {
        const base = new URL(startUrl).origin;
        const mainPage = await scrapePage(startUrl);
        if (mainPage) {
            results.push(mainPage);
            await Actor.pushData(mainPage);
        }

        // Crawl internal links that include common business pages
        const response = await axios.get(startUrl);
        const $ = cheerio.load(response.data);
        const links = $('a[href]')
            .map((i, el) => $(el).attr('href'))
            .get()
            .filter(href =>
                href &&
                !href.startsWith('#') &&
                !href.startsWith('mailto:') &&
                !href.includes('.pdf') &&
                !href.startsWith('tel:') &&
                (href.includes('about') ||
                 href.includes('contact') ||
                 href.includes('services') ||
                 href.includes('team') ||
                 href.includes('company'))
            )
            .map(href => href.startsWith('http') ? href : `${base}${href.startsWith('/') ? href : '/' + href}`);

        // Limit to 5 extra pages per site
        for (const link of links.slice(0, 5)) {
            const subPage = await scrapePage(link);
            if (subPage) {
                results.push(subPage);
                await Actor.pushData(subPage);
            }
        }

    } catch (err) {
        console.error(`❌ Error scraping ${startUrl}: ${err.message}`);
    }
}

console.log(`✅ Done scraping ${results.length} pages total.`);
await Actor.exit();
