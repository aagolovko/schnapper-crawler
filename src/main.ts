import {collections, connectToDatabase} from "./services/database.service.ts";
import {log} from "crawlee";
import {crawling} from "./utils/crawling.ts";
import {printStatistics} from "./printStatistics.ts";

const client = await connectToDatabase()

const startDate = new Date()

log.info(`Start crawling: ${startDate.toLocaleString()}`);

await (collections.articles!!.updateMany({locationGeocoded: {}}, {$set: {locationGeocoded: null}}))

await crawling()

await printStatistics(startDate);

await client.close(true);
