import { Actor } from 'apify';
import axios from 'axios';
import * as cheerio from 'cheerio';

await Actor.init();

const input = await Actor.getInput() || {
    startUrls: ["https://example.com"]
};

const results = [];

for (const url of input.startUrls) {
    try {
        console.log(`Scraping: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        const title = $('title').text().trim();
        const html = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000); // First 2000 chars of text

        // Extract emails + phones
        const emails = [...new Set(response.data.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g))];
        const phones = [...new Set(response.data.match(/\+?\d[\d\s().-]{8,}\d/g))];

        results.push({
            url,
            title,
            emails,
            phones,
            textSample: html
        });

        await Actor.pushData({ url, title, emails, phones, textSample: html });

    } catch (err) {
        console.error(`❌ Failed to scrape ${url}: ${err.message}`);
    }
}

console.log("✅ Done scraping all URLs!");
await Actor.exit();



