// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, Dataset } from 'crawlee';
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import { writeFileSync } from 'fs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const searchPageNumber = (url: string) => {
    let searchPageNum = 1

    if (!url.includes('seite:')) {
        // first search page
        return  1
    } else {
        let urlSplitted = url.split('/');
        searchPageNum = urlSplitted[4]?.split(':').at(1)
    }

    return searchPageNum
};

export function pad(num, size) {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
let options = {
    maxRequestsPerCrawl: 2,

    // Uncomment this option to see the browser window.
    headless: false,

    // Use the requestHandler to process each of the crawled pages.
    async requestHandler({ request, enqueueLinks, page, log }) {

        const spNumber = searchPageNumber(page.url())

        const title = await page.title();
        await page.once('load', () => {
            console.log('Page loaded!')
        });
        log.info(`Title of ${request.loadedUrl} is '${title}'`);


        // '//#site-search-query'           <<< input field for queries
        // '//#site-search-area'            <<< search area
        // '//#site-search-distance-inpt'   << distance arround th earea
        // '//#site-search-submit'          << submit search

        if (spNumber == 1) {
            await sleep(1000)

            try {
                let selector = '//input[@id="site-search-query"]'
                let element = await page.waitForSelector(selector);
                await element.type('regentonne')
            } catch (e) {
                log.error(e)
            }

            await sleep(1000)
            try {
                // >> close "accept cookies" only now, after text for search is entered
                // let selector1 = '//button[@id="gdpr-banner-cmp-button"]'
                let selector2 = '//button[@id="gdpr-banner-accept"]'
                let element = await page.locator(selector2)
                await element.click()
                log.info('clicked?');
            } catch (e) {
                log.error(e)
            }

            await sleep(1000)

            try {
                let selector = '//input[@id="site-search-area"]'
                let element = await page.waitForSelector(selector);
                await element.type('81375 Hadern')
            } catch (e) {
                log.error(e)
            }

            await sleep(1000)

            try {
                // let selector = '//ul[@id="site-search-distance-list"]'
                let selector = '//div[@id="site-search-distance"]'
                let element = await page.waitForSelector(selector);
                await element.click()

                // >> select "+10km" distance for search area
                await page.keyboard.press('ArrowDown')
                await page.keyboard.press('ArrowDown')  // +5km
                await page.keyboard.press('ArrowDown')  // +10km
                await page.keyboard.press('ArrowDown') // +20km
                await page.keyboard.press('ArrowDown') // +30km
                await page.keyboard.press('ArrowDown') // +50km
                await page.keyboard.press('ArrowDown') // +100km
                await page.keyboard.press('Enter')
            } catch (e) {
                log.error(e)
            }

            await sleep(1000)

            try {
                let selector = '//button[@id="site-search-submit"]'
                let element = await page.waitForSelector(selector);
                await element.click()
            } catch (e) {
                log.error(e)
            }

            await sleep(1000)
        }


        const content = await page.content()
        writeFileSync(`search-pages/file-${pad(spNumber,3)}.html`, content);

        // Find a link to the next page and enqueue it if it exists.
        await enqueueLinks({
            limit: 5,
            selector: '//div[@class="pagination-pages"]/a',
        });

        await sleep(1000)

        log.info('End')

        // NOTE: parsing done from the file in dir
        // try {
        //     // let selector = '//li[contains(@class, "ad-listitem")]'
        //     let selector = '//article'
        //     let elements = await page.$$(selector);
        //     for (const element of elements) {
        //         let href = await element.getAttribute('data-href')
        //         let location = await (await element.$('//div[@class="aditem-main--top--left"]'))?.innerText()
        //         log.info(`Found href ${href}, location ${location}`)
        //
        //     }
        // } catch (e) {
        //     log.error(e)
        // }


        //await page.waitForSelector(selector).then(() => page.click(selector) );

         // log.info('x');
         // // Save results as JSON to ./storage/datasets/default
        // await Dataset.pushData({ title, url: request.loadedUrl });

        // // Extract links from the current page
        // // and add them to the crawling queue.
        // await enqueueLinks();
    },
} as PlaywrightCrawlerOptions

const crawler = new PlaywrightCrawler(options);

// Add first URL to the queue and start the crawl.
await crawler.run(['https://www.kleinanzeigen.de/']);
