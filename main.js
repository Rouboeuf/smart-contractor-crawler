import { Actor } from 'apify';
import axios from 'axios';
import * as cheerio from 'cheerio';

await Actor.init();

const input = await Actor.getInput() || {
    startUrls: ["https://example.com"]
};

async function scrapePage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        $('script, style, noscript, iframe').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const title = $('title').text().trim();
        const emails = [...new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g))];
        const phones = [...new Set(html.match(/\+?\d[\d\s().-]{8,}\d/g))];

        return { url, html, text, title, emails, phones };
    } catch (err) {
        console.error(`❌ Error scraping ${url}: ${err.message}`);
        return null;
    }
}

async function scrapeCompany(baseUrl) {
    const base = new URL(baseUrl).origin;
    const mainPage = await scrapePage(baseUrl);
    if (!mainPage) return;

    const allText = [mainPage.text];
    const allHtml = [mainPage.html]; // keep homepage HTML only once

    // find internal pages
    let subpages = [];
    try {
        const response = await axios.get(baseUrl);
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
            .map(href => href.startsWith('http') ? href : `${base}${href.startsWith('/') ? href : '/' + href}`)
            .slice(0, 3); // only first 3 relevant pages
    } catch (err) {
        console.log(`⚠️ Could not extract subpages for ${baseUrl}: ${err.message}`);
    }

    // scrape subpages
    for (const link of subpages) {
        const sub = await scrapePage(link);
        if (sub) allText.push(sub.text);
    }

    const combinedText = allText.join(' ').replace(/\s+/g, ' ').trim();
    const uniqueEmails = [...new Set((mainPage.emails || []).flat())];
    const uniquePhones = [...new Set((mainPage.phones || []).flat())];

    const result = {
        company_url: baseUrl,
        title: mainPage.title,
        html: mainPage.html, // only homepage HTML
        text: combinedText,   // all readable text combined
        emails: uniqueEmails,
        phones: uniquePhones
    };

    await Actor.pushData(result);
    console.log(`✅ Scraped ${baseUrl} (${subpages.length} extra pages)`);
}

// run
for (const url of input.startUrls) {
    await scrapeCompany(url);
}

await Actor.exit();
