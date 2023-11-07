import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {log, PlaywrightCrawler} from "crawlee";
import {sleep} from "../utils/utils.ts";
import {v4 as uuidv4} from "uuid";
import {RequestQueue} from "apify";
import {parse} from "node-html-parser";
import {collections} from "../services/database.service.ts";
import {DO_HEADLESS} from "../config.ts";

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

        for (const articleHref of articleHrefs) {

            if (!articleHref.includes("/s-anzeige/regentonne-garantia-300-liter-mit-auslaufhahn/2605980854-87-5976")) {
                continue
            }

            await page.goto(articleHref)

            await sleep(100)
            log.info(`Checking article ${page.url()}`)
            await page.once('load', () => { });


            const content = await page.content()
            const root = parse(content)

            let expiredText = root.querySelectorAll('.pvap-reserved-image-veil:not(.is-hidden)')
                .map( x => x.text)
                .shift()
            expiredText ??= ""

            let isDeleted = ( expiredText === "Gelöscht" )

            if ( !isDeleted ) {
                const msg = root.querySelectorAll('.outcomemessage-warning').map( x => x.innerText.trim()).shift()
                let msg2 = root.querySelectorAll('.pvap-reserved-title:not(.is-hidden)').map( x => x.innerText.trim()).shift()
                msg2 ??= ""
                isDeleted = (msg === "Die gewünschte Anzeige ist nicht mehr verfügbar." || msg2.includes("Gelöscht") )
            }
            if (isDeleted) {
                log.info(`\x1B[31mExpired article ${articleHref}`)
                let hrefShort = articleHref.replace('https://www.kleinanzeigen.de','')
                hrefShort = hrefShort.replace('https://ebay-kleinanzeigen.de','')
                hrefShort = hrefShort.replace('//','/')

                const article = await collections.articles!!.findOne({ href: hrefShort});
                if (article) {
                    await collections.articles!!.updateOne({_id: article._id}, {$set: {unavailableOn: new Date()}})
                }

            }

            await sleep(100)
        }

    }

    // Add first URL to the queue and start the crawl.
    await crawler.run(["https://www.kleinanzeigen.de/"]);
    await crawler.teardown()
}
