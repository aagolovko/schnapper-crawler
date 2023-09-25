import {collections, connectToDatabase} from "./services/database.service.ts";
import {Article} from "./models/article";
import {log} from "crawlee";
import {crawlForArticle} from "./utils/crawlForArticle.ts";

const client = await connectToDatabase()

const availableFavorites: Article[] = await (await collections.articles.find(
    {isFavorite: true, unavailableOn: {$exists: false}}
)).toArray();

const startDate = new Date()

log.info(``)
log.info(``)
log.info(`Going to check for ${availableFavorites.length} articles`)
log.info(`Start: ${startDate.toLocaleString()}`);
log.info(``)
log.info(``)


// const deleted = "https://www.kleinanzeigen.de/s-anzeige/ibc-container-wassertank-tank-1000-liter/2470880840-87-7061"
// const notdeleted = "https://www.kleinanzeigen.de/s-anzeige/scool-20-zoll-fahrrad/2551486293-217-6432"
// const deleted2 = "https://www.kleinanzeigen.de/s-anzeige/regentonne-von-speidel-300-liter-/2500003355-87-6311"

log.info(`Going to check articles: ${availableFavorites.length}`)

const hrefs = availableFavorites.map( a => `https://www.kleinanzeigen.de${a.href}`)
await crawlForArticle([...hrefs], client)


const endDate = new Date()
log.info(``)
log.info(`End: ${endDate.toLocaleString()}`);
const diffInMinutes = (endDate.getTime() - startDate.getTime())/(1000*60)
log.info(`Duration (minutes): ${diffInMinutes}`)

log.info(``)
log.info(`>>> DONE <<<<`)
log.info(``)

client.close()
