import { CheerioCrawler, Dataset, log } from 'crawlee';
import Apify from 'apify';

log.setLevel(log.LEVELS.INFO);

Apify.main(async () => {
  const input = await Apify.getInput();
  const { startUrls = [], maxConcurrency = 10 } = input || {};

  if (!startUrls.length) {
    throw new Error('No startUrls provided.');
  }

  const crawler = new CheerioCrawler({
    maxConcurrency,
    requestHandlerTimeoutSecs: 60,
    async requestHandler({ request, $, response }) {
      const title = $('title').text().trim();
      const metaDesc = $('meta[name="description"]').attr('content') || '';
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      const emails = Array.from(
        new Set((text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))
      );

      const phones = Array.from(
        new Set((text.match(/(?:\+\d{1,2}\s?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g) || []))
      );

      await Dataset.pushData({
        url: request.loadedUrl,
        statusCode: response?.statusCode || null,
        title,
        metaDesc,
        emails,
        phones,
        textSnippet: text.slice(0, 600)
      });

      log.info(`✅ Scraped: ${request.loadedUrl}`);
    },
    failedRequestHandler({ request }) {
      log.error(`❌ Failed: ${request.url}`);
    },
  });

  await crawler.run(startUrls);
  log.info('🎉 Done.');
});


