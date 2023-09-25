import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {log, PlaywrightCrawler} from "crawlee";
import {sleep} from "../utils/utils.ts";
import {v4 as uuidv4} from "uuid";
import {RequestQueue} from "apify";
import {parse} from "node-html-parser";
import {MongoClient} from "mongodb";
import {collections} from "../services/database.service.ts";

export async function crawlForArticle(articleHrefs: string[], client: MongoClient) {
    let uuid = uuidv4()
    const requestQueue = await RequestQueue.open(`rq-${uuid}`)

    const crawlerConfig = {
        maxRequestsPerCrawl: 200,

        requestQueue,

        // Uncomment this option to see the browser window.
        headless: true,

        requestHandler
    } as PlaywrightCrawlerOptions;
    const crawler = new PlaywrightCrawler(crawlerConfig);

    // Use the requestHandler to process each of the crawled pages.
    async function requestHandler({request, response, page}) {
        log.info(`Checking article ${request.url}`)

        await page.once('load', () => { });

        const content = await page.content()
        const root = parse(content)

        const expiredText = root.querySelectorAll('.pvap-reserved-image-veil')
        const notHidden = expiredText
            .filter( x => !x.classNames.includes('is-hidden'))
            .map( x => x.text)
            .shift()

        let isDeleted = ( notHidden === "Gelöscht" )

        if ( !isDeleted ) {
            const msg = root.querySelectorAll('.outcomemessage-warning').map( x => x.innerText.trim()).shift()
            isDeleted = (msg === "Die gewünschte Anzeige ist nicht mehr verfügbar.")
        }
        if (isDeleted) {
            log.info(`\x1B[31mExpired article ${request.url}`)
            let hrefShort = request.url.replace('https://www.kleinanzeigen.de','')
            hrefShort = hrefShort.replace('https://ebay-kleinanzeigen.de','')
            const article = await collections.articles.findOne({ href: hrefShort});
            await collections.articles.updateOne({_id: article._id}, {$set: {unavailableOn: new Date()}})
        }

        await sleep(1000)
    }

    // Add first URL to the queue and start the crawl.
    await crawler.run(articleHrefs);
    await crawler.teardown()
}
