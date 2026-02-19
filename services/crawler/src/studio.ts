// For more information, see https://crawlee.dev/
import { Sitemap } from '@crawlee/utils';
import { PlaywrightCrawler } from '@crawlee/playwright';
import { ensureDocsAndChunksCollections, retrieveAllUrls } from '@digdir/assistant-lib';
import { createRouter, failedRequestHandler } from './routes.ts';
import { Command } from 'commander';

async function main() {
  const program = new Command();
  program
    .name('crawl-studio-docs')
    .description('Crawl the Altinn Studio documentation site')
    .version('0.1.0');

  program.requiredOption(
    '-c, --collection <string>',
    "docs collection to update.\n   Chunks collections name will be derived by replacing 'docs' with 'chunks'.",
  );

  program.parse(process.argv);
  const opts = program.opts();
  let docsCollectionName = opts.collection;

  // make sure we have a target collection to update
  await ensureDocsAndChunksCollections(docsCollectionName);

  const router = createRouter(docsCollectionName, filterUrlsToCrawl);
  const crawler = new PlaywrightCrawler({
    // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
    requestHandler: router,
    headless: true,
    failedRequestHandler: failedRequestHandler,

    // Comment this option to scrape the full website.
    // maxRequestsPerCrawl: 10,
  });

  const { urls } = await Sitemap.load('https://docs.altinn.studio/en/sitemap.xml');

  function filterUrlsToCrawl(urls: string[]): string[] {
    const crawlRoutes = [
      // 'https://github.com/Altinn/altinn-studio/issues/',
      // 'https://github.com/digdir/roadmap/issues/',
      'https://docs.altinn.studio/',
    ];

    const ignoreRoutes = [
      'https://docs.altinn.studio/app/app-dev-course',
      'https://docs.altinn.studio/altinn-studio/news/launched-apps/',
      'https://docs.altinn.studio/tags',
      'https://docs.altinn.studio/api',
      'https://docs.altinn.studio/app/development/data/options/altinn2-codelists',
      'https://docs.altinn.studio/community/changelog/app-nuget',
      'https://docs.altinn.studio/community/about/slide/',
      'https://docs.altinn.studio/nb/',
      'https://docs.altinn.studio/community/contributing/intro/',
    ];

    return urls.filter(
      (url) =>
        crawlRoutes.some((route) => url.startsWith(route)) &&
        !ignoreRoutes.some((route) => url.startsWith(route)),
    );
  }

  await crawler.addRequests(filterUrlsToCrawl(urls));

  // Run the crawler
  await crawler.run();

  const dataset = await crawler.getDataset();
  const allData = await dataset.getData();

  if (allData.items.length > 0) {
    await dataset.exportToCSV('results');
  } else {
    console.warn('Dataset is empty or unavailable, skipping CSV export.');
  }

  // Replace the union and difference functions with custom logic

  // Custom union function
  function customUnion(setA: Set<string>, setB: Set<string>): Set<string> {
    const unionSet = new Set(setA);
    for (const item of setB) {
      unionSet.add(item);
    }
    return unionSet;
  }

  // Custom difference function
  function customDifference(setA: Set<string>, setB: Set<string>): Set<string> {
    const differenceSet = new Set(setA);
    for (const item of setB) {
      differenceSet.delete(item);
    }
    return differenceSet;
  }

  // Replace the union and difference functions in the code
  let i = 1;
  let alreadyIndexed = new Set<string>();
  let newUrls: string[] = [];
  do {
    newUrls = await retrieveAllUrls(docsCollectionName, i, 250);
    alreadyIndexed = customUnion(alreadyIndexed, new Set(newUrls));
    i++;
  } while (newUrls.length > 0);

  const crawledUrls = new Set<string>(
    allData.items.filter((item) => item.status == 'success').map((item) => item.url),
  );
  const redirectedUrls = new Set<string>(
    allData.items.filter((item) => item.status == 'redirected').map((item) => item.url),
  );
  const failedUrls = new Set<string>(
    allData.items.filter((item) => item.status == 'failed').map((item) => item.url),
  );
  const urlsToRemove = customDifference(alreadyIndexed, crawledUrls);
  const newUrlsAdded = customDifference(crawledUrls, alreadyIndexed);

  console.log(`Redirected:\n`, Array.from(redirectedUrls));
  console.log(`To remove:\n`, Array.from(urlsToRemove));
  console.log(`New:\n`, Array.from(newUrlsAdded));
  console.log(`Failed:\n`, Array.from(failedUrls));
  console.log(
    `Last crawl: ${alreadyIndexed.size} | This crawl: ${crawledUrls.size} | Redirected: ${redirectedUrls.size} | Removed: ${urlsToRemove.size} | New: ${newUrlsAdded.size} | Failed: ${failedUrls.size}`,
  );
}

await main();
