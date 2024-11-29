import {log, PlaywrightCrawler} from 'crawlee';
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {searchPageNumber, sleep} from "./utils.ts";
import {SearchRequest} from "../models/searchRequest";
import {RequestQueue} from "apify";
import {v4 as uuidv4} from 'uuid';
import {searchRequestsToCrawl} from "../crawling.ts";
import {Page} from "playwright";
import {MAX_SEARCH_PAGES_FOR_KEYWORD, DO_HEADLESS, INITIAL_SEARCH_PAGE, PAUSE_MS, WAIT_FOR_SELECTOR} from "../config.ts";
import {parse} from "node-html-parser";
import {collections} from "../services/database.service.ts";

const updateOrInsertSearchRequest = async (found: any, object: any, updatedFields: any) => {
    if (found) {
        await collections.searchRequests!!.updateMany({_id: found._id}, {$set: updatedFields})
    } else {
        await collections.searchRequests!!.insertOne({...object, ...updatedFields})
    }
}

async function inputSearchRequest(searchRequest: SearchRequest, page: Page) {
    log.info(`Enter UI search fields for keyword: ${searchRequest.keyword}`)
    await inputSearchQuery(page, searchRequest.keyword)

    await sleep(PAUSE_MS)
    await inpuSearchArea(page, searchRequest.searchArea)

    await sleep(PAUSE_MS)
    await inputSearchDistance(page, searchRequest.searchDistance)

    await sleep(PAUSE_MS * 2)
    await submitSearch(page);

    // await sleep(PAUSE_MS*4)
    // if (searchRequest.maxPrice) {
    //     await inputMaxPrice(page, searchRequest.maxPrice)
    // }

    await sleep(PAUSE_MS * 6)
}

export async function crawlForSearchProfile(searchPageHandler: (searchKeyword: string, content: string, contentHref: string) => void) {

    let uuid = uuidv4()
    const requestQueue = await RequestQueue.open(`rq-${uuid}`)

    const crawlerConfig = {
        requestQueue,

        // Uncomment this option to see the browser window.
        headless: DO_HEADLESS,

        requestHandler: browserPage
    } as PlaywrightCrawlerOptions;
    const crawler = new PlaywrightCrawler(crawlerConfig);

    // Use the requestHandler to process each of the crawled pages.
    // @ts-ignore
    async function browserPage({enqueueLinks, page}) {

        const searchRequests = await searchRequestsToCrawl();

        await page.once('load', () => {});

        await sleep(PAUSE_MS)
        await sleep(PAUSE_MS)
        await clickAcceptCookies(page);

        await sleep(PAUSE_MS)
        await clickCloseRegisterPopup(page)

        log.info(`We crawl on the url page: ${page.url()}`)
        log.info(``)

        const spNumber = searchPageNumber(page.url())

        if (spNumber > 0) {
            log.info(`Parsing one of the next search pages ${page.url()}`)
            log.info(``)

            let selector = '//input[@id="site-search-query"]'
            let element = await page.waitForSelector(selector);
            const content = await page.content()
            searchPageHandler(element.value, content, page.url())
        }

        if (INITIAL_SEARCH_PAGE == page.url()) {
            for (const searchRequest of searchRequests) {
                await inputSearchRequest(searchRequest, page);

                log.info(`Parsing search page ${page.url()}`)
                await page.once('load', () => {});
                const content = await page.content()
                searchPageHandler(searchRequest.keyword, content, page.url())

                //     const summary = root.querySelector('.breadcrump-summary')?.innerText?.match(/(\d+)/gm).slice(0, 3)
                //     if (summary && summary.length == 3 && metaInfoHandler) {
                //         metaInfoHandler(Number(summary[0]), Number(summary[1]), Number(summary[2]))
                //     }
                const foundSearchRequest = await collections.searchRequests!!.findOne(searchRequest);
                await updateOrInsertSearchRequest(foundSearchRequest, searchRequest, {articlesFound: 0 /*TODO*/, lastSearch: new Date()})

                let nextPages: string[] = []
                try {
                    const content = await page.content()
                    const root = parse(content)
                    let selector = '.pagination-pages a'
                    let nextPageElements = root.querySelectorAll(selector);

                    for (const el of nextPageElements) {
                        let href = el.getAttribute('href');
                        if (href) {
                            nextPages.push(`https://www.kleinanzeigen.de${href}`)
                        }
                    }
                } catch (e) {
                    log.error(`during fetch of next pages ${e}`)
                }

                const nextPagesTotal = nextPages.length
                const maxNextPagesAllowed = MAX_SEARCH_PAGES_FOR_KEYWORD - 1
                const maxNextPagesToCrawl = Math.min(maxNextPagesAllowed, nextPagesTotal)

                if (maxNextPagesToCrawl > 0) {
                    const urlsToCrawl = nextPages.slice(0, maxNextPagesToCrawl)
                    log.info(`TODO: crawl ${maxNextPagesToCrawl} from total ${nextPagesTotal} for ${searchRequest.keyword}`)
                    // enqueueLinks({urls: urlsToCrawl});
                }
            }


        }
    }

    // Add first URL to the queue and start the crawl.
    await crawler.run([INITIAL_SEARCH_PAGE]);
    await crawler.teardown()
}

async function inpuSearchArea(page: Page, searchArea: string) {
    try {
        // search area, like "Hadern"
        let selector = '//input[@id="site-search-area"]'
        let element = await page.waitForSelector(selector);
        await element.click({clickCount: 3})
        await element.type(searchArea)
    } catch (e) {
        log.error(`inputSearchArea ${e}`)
    }
}

async function inputSearchQuery(page: Page, keyword: string) {
    try {
        // input field for queries
        let selector = '//input[@id="site-search-query"]'
        let element = await page.waitForSelector(selector);
        await element.click({clickCount: 3})
        await element.type(keyword)
    } catch (e) {
        log.error(`inpuSearchQuery ${e}`)
    }
}

async function inputMaxPrice(page: Page, maxPrice: number) {
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

async function clickAcceptCookies(page: Page) {
    // alternative way to "allow cookies" is to open other page
    // let selector1 = '//button[@id="gdpr-banner-cmp-button"]'

    // >> close "accept cookies" only now, after text for search is entered
    let selector = '//button[@id="gdpr-banner-accept"]'
    page.waitForSelector(selector, {timeout: WAIT_FOR_SELECTOR}).then((button) => {
        button.click()
    }, (failure) => {
        log.warning(`Failed to resolve 'cookies' banner, but it is not a problem: ${failure}`)
    })
}

async function clickCloseRegisterPopup(page: Page) {
    try {
        let selector = '//a[@class="j-overlay-close overlay-close"]'
        let element = await page.waitForSelector(selector, {timeout: WAIT_FOR_SELECTOR})
        await element.click()
    } catch (e) {
        log.debug(`clickCloseRegisterPopup ${e}`)
    }
}

async function inputSearchDistance(page: Page, searchDistance: string) {
    log.debug(`Search distance (not used yet): ${searchDistance}`)
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
        log.error(`inputSearchDistance ${e}`)
        throw e
    }
}

async function submitSearch(page: Page) {
    try {
        // submit button
        let selector = '//button[@id="site-search-submit"]'
        let element = await page.waitForSelector(selector, {timeout: WAIT_FOR_SELECTOR});
        await element.click()
    } catch (e) {
        log.error(`submitSearch ${e}`)
    }
}


