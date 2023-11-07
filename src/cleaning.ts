import {collections, connectToDatabase} from "./services/database.service.ts";
import {Article} from "./models/article";
import {log} from "crawlee";
import {crawlForArticle} from "./utils/crawlForArticle.ts";

const client = await connectToDatabase()

const availableFavorites: Article[] = await (collections.articles!!.find(
    {isFavorite: true, unavailableOn: {$exists: false}}
).toArray());

const startDate = new Date()

log.info(``)
log.info(``)
log.info(`Going to check for ${availableFavorites.length} articles`)
log.info(`Start: ${startDate.toLocaleString()}`);
log.info(``)
log.info(``)

log.info(`Going to check articles: ${availableFavorites.length}`)

const hrefs = availableFavorites.map( a => `https://www.kleinanzeigen.de${a.href}`)
// const hrefs2 = hrefs.filter( it => it === "https://www.kleinanzeigen.de/s-anzeige/kamin-bodenplatte/2581375725-87-6185")
// const hrefs = ["https://www.kleinanzeigen.de/s-anzeige/zu-verschenken-kaninchenstall-und-euro-palette/2577950408-192-6189"]
await crawlForArticle([...hrefs])


const endDate = new Date()
log.info(``)
log.info(`End: ${endDate.toLocaleString()}`);
const diffInMinutes = (endDate.getTime() - startDate.getTime())/(1000*60)
log.info(`Duration (minutes): ${diffInMinutes}`)

log.info(``)
log.info(`>>> DONE <<<<`)
log.info(``)

await client.close()
