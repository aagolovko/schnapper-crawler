// For more information, see https://crawlee.dev/
import {writeFileSync} from 'fs';
import {collections, connectToDatabase} from "./services/database.service.ts";
import {crawlForSearchProfile} from "./utils/crawler.ts";
import {log} from "crawlee";
import {sleep} from "./utils/utils.ts";

const client = await connectToDatabase()
const found = await collections.searchProfiles.find({});
const searchProfiles = await found.toArray();
await client.close()

let counter = 0

const searchRequests: any = []
for (const searchProfile of searchProfiles) {
    for (const searchKeyword of searchProfile.keywords) {
        for (const searchLocation of searchProfile.locations) {
            // DEBUG HELPER
            // if (counter >= 2) {
            //     log.info("Leaving with break")
            //     break
            // }
            const searchRequest = {
                keyword: searchKeyword,
                searchArea: searchLocation.searchArea,
                searchDistance: searchLocation.searchDistance,
            }

            searchRequests.push(searchRequest)
        }
    }
}

log.info(``)
log.info(``)
log.info(`Going to issue for ${searchRequests.length} search requests`)
log.info(``)
log.info(``)

for (const searchRequest of searchRequests) {
    counter++

    log.info(`[${counter.toString().padStart(3, '0')}/${searchRequests.length.toString().padStart(3, '0')}]: Search request ${JSON.stringify(searchRequest)}`)
    await crawlForSearchProfile(searchRequest, (content: string, spHref: string) => {
        const splitted = spHref.split('/')
        const fileName = splitted.length == 0 ? 'unknown' : splitted.slice(3).join('-').replaceAll(':', '-')
        writeFileSync(`search-pages/${fileName}.html`, content);
    })


    await sleep(5000)

}

log.info(`>>> DONE <<<<`)

