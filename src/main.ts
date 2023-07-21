// For more information, see https://crawlee.dev/
import {writeFileSync} from 'fs';
import {collections, connectToDatabase} from "./services/database.service.ts";
import {crawlForSearchProfile} from "./crawler.ts";
import {log, PlaywrightCrawler} from "crawlee";
import {sleep} from "./utils.ts";
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {RequestQueue} from "apify";

const client = await connectToDatabase()
const found = await collections.searchProfiles.find({});
const searchProfiles = await found.toArray();
await client.close()

let counter = 0

// const urls = ["https://www.kleinanzeigen.de/", "https://www.kleinanzeigen.de/"]
// for (const url of urls) {
//
//     const requestQueue = await RequestQueue.open(`requeue-${counter}`)
//     const crawlerConfig = {
//
//         requestQueue: requestQueue,
//
//         maxRequestsPerCrawl: 10,
//
//         // Uncomment this option to see the browser window.
//         headless: false,
//
//         requestHandler
//     } as PlaywrightCrawlerOptions;
//     const crawler = new PlaywrightCrawler(crawlerConfig);
//
//     async function requestHandler({request, enqueueLinks, page}) {
//
//     }
//
//     await crawler.run([url])
//     log.info(`XXXXXXXX XXXXXX ${url}`)
//     counter++
// }

for (const searchProfile of searchProfiles) {
    for (const searchKeyword of searchProfile.keywords) {
        for (const searchLocation of searchProfile.locations) {
            // if (counter >= 2) {
            //     log.info("Leaving with break")
            //     break
            // }
            const searchRequest = {
                keyword: searchKeyword,
                searchArea: searchLocation.searchArea,
                searchDistance: searchLocation.searchDistance,
            }

            log.info(JSON.stringify(searchRequest))
            await crawlForSearchProfile(searchRequest, (content: string, spHref: string) => {
                const splitted = spHref.split('/')
                const fileName = splitted.slice(3).join('-').replaceAll(':', '-')
                writeFileSync(`search-pages/${fileName}.html`, content);
            })




            await sleep(5000)

            counter++
        }
    }
}


log.info(`>>> DONE <<<<`)

