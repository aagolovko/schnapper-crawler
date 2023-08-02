// For more information, see https://crawlee.dev/
import {log, PlaywrightCrawler} from 'crawlee';
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {searchPageNumber, sleep} from "./utils.ts";
import {SearchRequest} from "../models/searchRequest";
import {RequestQueue} from "apify";
import {v4 as uuidv4} from 'uuid';
import {DO_HEADLESS} from "../crawling.ts";

const PAUSE_MS = 1000

export async function crawlForSearchProfile(searchRequest: SearchRequest, searchPageHandler: (str: string, spHref: string) => void) {
    let uuid = uuidv4()
    const requestQueue = await RequestQueue.open(`rq-${uuid}`)

    const crawlerConfig = {
        maxRequestsPerCrawl: 20,

        requestQueue,

        // Uncomment this option to see the browser window.
        headless: DO_HEADLESS,

        requestHandler
    } as PlaywrightCrawlerOptions;
    const crawler = new PlaywrightCrawler(crawlerConfig);

    // Use the requestHandler to process each of the crawled pages.
    async function requestHandler({request, enqueueLinks, page}) {

        await page.once('load', () => { });

        const spNumber = searchPageNumber(page.url())
        if (spNumber == 0) {
            await sleep(PAUSE_MS)
            await sleep(PAUSE_MS)
            await clickAcceptCookies(page);

            await sleep(PAUSE_MS)
            await clickCloseRegisterPopup(page)

            await inputSearchQuery(page, searchRequest.keyword)

            await sleep(PAUSE_MS)
            await inpuSearchArea(page, searchRequest.searchArea)

            await sleep(PAUSE_MS)
            await inputSearchDistance(page, searchRequest.searchDistance)

            await sleep(PAUSE_MS*2)
            await submitSearch(page);

            if (searchRequest.maxPrice) {
                await inputMaxPrice(page, searchRequest.maxPrice)
            }


            await sleep(PAUSE_MS)
        } else {
            // DO NOTHING
        }

        const content = await page.content()
        const crawlNext = searchPageHandler(content, page.url())

        if (crawlNext) {
            // Find a link to the next page and enqueue it if it exists.
            await enqueueLinks({
                limit: 10,
                selector: '//div[@class="pagination-pages"]/a',
            });
        }

        await sleep(PAUSE_MS)
    }

    // Add first URL to the queue and start the crawl.
    await crawler.run(['https://www.kleinanzeigen.de/']);
    await crawler.teardown()
}

async function inpuSearchArea(page, searchArea: string) {
    try {
        // search area, like "Hadern"
        let selector = '//input[@id="site-search-area"]'
        let element = await page.waitForSelector(selector);
        await element.type(searchArea)
    } catch (e) {
        log.error(`inputSearchArea ${e}`)
    }
}

async function inputSearchQuery(page, keyword: string) {
    try {
        // input field for queries
        let selector = '//input[@id="site-search-query"]'
        let element = await page.waitForSelector(selector);
        await element.type(keyword)
    } catch (e) {
        log.error(`inpuSearchQuery ${e}`)
    }
}

async function inputMaxPrice(page, maxPrice: number) {
    try {
        // input field for queries
        let selector = '//input[@id="srchrslt-brwse-price-max"]'
        let element = await page.waitForSelector(selector);
        await element.type(`${maxPrice}`)

        let selectorBtn = '//input[@id="srchrslt-brwse-price-max"]/parent::fieldset/parent::div/button'
        let elementBtn = await page.waitForSelector(selectorBtn);
        await elementBtn.click()
    } catch (e) {
        log.error(`inputMaxPrice ${e}`)
    }
}

async function clickAcceptCookies(page) {
    // alternative way to "allow cookies" is to open other page
    // let selector1 = '//button[@id="gdpr-banner-cmp-button"]'

    // >> close "accept cookies" only now, after text for search is entered
    let selector = '//button[@id="gdpr-banner-accept"]'
    page.waitForSelector(selector, {timeout: 5000}).then( (button) => {
        button.click()
    }, (failure) => {
        log.warning("Failed to resolve 'cookies' banner, but it is not a problem")
    })
}

async function clickCloseRegisterPopup(page) {
    try {
        let selector = '//a[@class="j-overlay-close overlay-close"]'
        let element = await page.waitForSelector(selector)
        await element.click()
    } catch (e) {
        log.debug(`clickCloseRegisterPopup ${e}`)
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
        // await page.keyboard.press('ArrowDown') // +100km
        await page.keyboard.press('Enter')
    } catch (e) {
        log.error(`inputSearchDistance ${e}`)
    }
}

async function submitSearch(page) {
    try {
        // submit button
        let selector = '//button[@id="site-search-submit"]'
        let element = await page.waitForSelector(selector);
        await element.click()
    } catch (e) {
        log.error(`submitSearch ${e}`)
    }
}


