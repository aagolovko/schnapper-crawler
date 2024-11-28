import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {log, PlaywrightCrawler} from "crawlee";
import {sleep} from "../utils/utils.ts";
import {v4 as uuidv4} from "uuid";
import {RequestQueue} from "apify";
import {parse} from "node-html-parser";
import {collections} from "../services/database.service.ts";
import {DO_HEADLESS, MIN_TIME_BETWEEN_SEARCHES_MINUTES} from "../config.ts";

log.setLevel(log.LEVELS.ERROR);

export async function crawlForArticle(articleHrefs: string[]) {
    let uuid = uuidv4()
    const requestQueue = await RequestQueue.open(`rq-${uuid}`)

    const crawlerConfig = {
        maxRequestsPerCrawl: 200,

        requestQueue,

        // Uncomment this option to see the browser window.
        headless: DO_HEADLESS,

        requestHandler
    } as PlaywrightCrawlerOptions;
    const crawler = new PlaywrightCrawler(crawlerConfig);

    // Use the requestHandler to process each of the crawled pages.
    // @ts-ignore
    async function requestHandler({request, page}) {

        await page.once('load', () => { });

        let expiredCounter = 0
        for (const articleHref of articleHrefs) {
            const hrefShort = articleHref.replace('https://www.kleinanzeigen.de','')
                .replace('https://ebay-kleinanzeigen.de','')
                .replace('//','/')

            const articleDb = await collections.articles!!.findOne({ href: hrefShort});
            const diffInMinutesSearchRequest: number = articleDb?.lastChecked ? (Date.now() - new Date(articleDb?.lastChecked).getTime()) / (1000 * 60) : 0
            const doCheck = !articleDb?.lastChecked || diffInMinutesSearchRequest > MIN_TIME_BETWEEN_SEARCHES_MINUTES

            if (!doCheck) {
                log.info(`\x1B[32mSkipped article check for ${articleHref}`)
                continue
            }

            await page.goto(articleHref)

            await sleep(300)
            await page.once('load', () => { });


            const content = await page.content()
            const root = parse(content)

            let expiredText = root.querySelectorAll('.pvap-reserved-image-veil:not(.is-hidden)')
                .map( element => element.text)
                .shift()
            expiredText ??= ""

            let isDeleted = ( expiredText === "Gelöscht" )

            if ( !isDeleted ) {
                const msg = root.querySelectorAll('.outcomemessage-warning').map( x => x.innerText.trim()).shift()
                let msg2 = root.querySelectorAll('.pvap-reserved-title:not(.is-hidden)').map( x => x.innerText.trim()).shift()
                msg2 ??= ""
                isDeleted = (msg === "Die gewünschte Anzeige ist nicht mehr verfügbar." || msg2.includes("Gelöscht") )
            }

            if (isDeleted && articleDb) {
                log.info(`\x1B[31mExpired article ${articleHref}`)
                await collections.articles!!.updateMany({_id: articleDb._id}, {$set: {unavailableOn: new Date()}})
                expiredCounter++
            } else if (articleDb) {
                log.info(`Article still available for ${articleHref}`)
                await collections.articles!!.updateMany({_id: articleDb._id}, {$set: {lastChecked: new Date()}})
            }
        }

        log.info(``)
        log.info(``)
        log.info(`Total of expired articles ${expiredCounter}`)
        log.info(``)

    }

    // Add first URL to the queue and start the crawl.
    await crawler.run(["https://www.kleinanzeigen.de/"]);
    await crawler.teardown()
}
