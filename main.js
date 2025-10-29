import { CheerioCrawler, Dataset, log } from 'crawlee';
import Apify from 'apify';

log.setLevel(log.LEVELS.INFO);

Apify.main(async () => {
    const input = await Apify.getInput();
    const { startUrls = [], maxConcurrency = 10 } = input;

    const crawler = new CheerioCrawler({
        maxConcurrency,
        requestHandlerTimeoutSecs: 60,
        async requestHandler({ request, $, response }) {
            const title = $('title').text().trim();
            const metaDesc = $('meta[name="description"]').attr('content') || '';
            const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);

            const emails = [...new Set(
                bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
            )] || [];

            const phones = [...new Set(
                bodyText.match(/(?:\+\d{1,2}\s?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g)
            )] || [];

            await Dataset.pushData({
                url: request.loadedUrl,
                statusCode: response.statusCode,
                title,
                metaDesc,
                emails,
                phones,
                textSnippet: bodyText.slice(0, 400),
            });

            log.info(`✅ Scraped: ${request.loadedUrl}`);
        },
        failedRequestHandler({ request }) {
            log.error(`❌ Failed: ${request.url}`);
        },
    });

    await crawler.run(startUrls);
    log.info('🎉 Crawling finished!');
});

