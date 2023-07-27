// For more information, see https://crawlee.dev/
import {writeFileSync} from 'fs';
import {collections, connectToDatabase} from "./services/database.service.ts";
import {crawlForSearchProfile} from "./crawler.ts";
import {log} from "crawlee";
import {sleep} from "./utils.ts";

const client = await connectToDatabase()
const found = await collections.searchProfiles.find({});
const searchProfiles = await found.toArray();
await client.close()

let counter = 0

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

