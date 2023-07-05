// For more information, see https://crawlee.dev/
import {PlaywrightCrawler} from 'crawlee';
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {log} from "crawlee";
import {searchPageNumber, sleep} from "./utils.ts";
import {SearchRequest} from "./models/searchRequest";


export async function crawlForSearchProfile(searchRequest: SearchRequest, searchPageHandler: (str: string, spHref: string) => void) {

    // Use the requestHandler to process each of the crawled pages.
    async function requestHandler({request, enqueueLinks, page}) {

        log.info(searchRequest.keyword)
        const spNumber = searchPageNumber(page.url())

        const title = await page.title();
        await page.once('load', () => {
            console.log('Page loaded!')
        });
        log.info(`Title of ${request.loadedUrl} is '${title}'`);

        if (spNumber == 1) {
            await sleep(1000)
            await inputSearchQuery(page, searchRequest.keyword)

            await sleep(1000)
            await clickAcceptCookies(page);

            await sleep(1000)
            await inpuSearchArea(page, searchRequest.searchArea)

            await sleep(1000)
            await inputSearchDistance(page, searchRequest.searchDistance)

            await sleep(1000)
            await submitSearch(page);

            await sleep(1000)
        } else {
            log.info('Navi to the next search pages')
        }

        const content = await page.content()
        searchPageHandler(content, page.url())

        // Find a link to the next page and enqueue it if it exists.
        await enqueueLinks({
            limit: 3,
            selector: '//div[@class="pagination-pages"]/a',
        });

        await sleep(1000)
    }

    const crawler = new PlaywrightCrawler(
        {
            maxRequestsPerCrawl: 1,

            // Uncomment this option to see the browser window.
            headless: false,

            requestHandler
        } as PlaywrightCrawlerOptions
    );

    // Add first URL to the queue and start the crawl.
    await crawler.run(['https://www.kleinanzeigen.de/']);
}

async function inpuSearchArea(page, searchArea: string) {
    try {
        // search area, like "Hadern"
        let selector = '//input[@id="site-search-area"]'
        let element = await page.waitForSelector(selector);
        await element.type(searchArea)
    } catch (e) {
        log.error(e)
    }
}

async function inputSearchQuery(page, keyword: string) {
    try {
        // input field for queries
        let selector = '//input[@id="site-search-query"]'
        let element = await page.waitForSelector(selector);
        await element.type(keyword)
    } catch (e) {
        log.error(e)
    }
}

async function clickAcceptCookies(page) {
    try {
        // alternative way to "allow cookies" is to open other page
        // let selector1 = '//button[@id="gdpr-banner-cmp-button"]'

        // >> close "accept cookies" only now, after text for search is entered
        let selector = '//button[@id="gdpr-banner-accept"]'
        let element = await page.locator(selector)
        await element.click()
    } catch (e) {
        log.error(e)
    }
}

async function inputSearchDistance(page, searchDistance: string) {
    try {
        // distance arround the area, like "+20km"
        let selector = '//div[@id="site-search-distance"]'
        let element = await page.waitForSelector(selector);
        await element.click()

        // TODO: map string to click on drop down for distance

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
}

async function submitSearch(page) {
    try {
        // submit button
        let selector = '//button[@id="site-search-submit"]'
        let element = await page.waitForSelector(selector);
        await element.click()
    } catch (e) {
        log.error(e)
    }
}


