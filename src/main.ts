// For more information, see https://crawlee.dev/
import { writeFileSync } from 'fs';
import {connectToDatabase, collections} from "./services/database.service.ts";
import {log} from "crawlee";
import {SearchProfile} from "./models/searchProfile";
import {crawlForSearchProfile} from "./crawler.ts";
import {pad} from "./utils";

const client = await connectToDatabase()
const found = await collections.searchProfiles.find({});
const searchProfiles = await found.toArray();
await client.close()


const searchProfile: SearchProfile = searchProfiles.shift()
const searchLocation = searchProfile.locations.shift()
const searchRequest = {
    keyword: searchProfile.keywords.shift(),
    searchArea: searchLocation.searchArea,
    searchDistance: searchLocation.searchDistance,
}

await crawlForSearchProfile(searchRequest, (content: string, spHref: string) => {
    const splitted = spHref.split('/')
    const fileName = splitted.slice(3).join('-').replaceAll(':', '-')
    writeFileSync(`search-pages/${fileName}.html`, content);
})
