import {collections, connectToDatabase} from "./services/database.service.ts";
import {log} from "crawlee";
import {Article} from "./models/article";

import {SearchRequest} from "./models/searchRequest";
import {geocodeLocation} from "./utils/geocoding.ts";
import {
    DEBUG_SEARCH_KEYWORDS,
    FORCE_UPDATE,
    MIN_TIME_BETWEEN_SEARCHES_MINUTES,
    ONLY_ALLOWED_KEYWORDS
} from "./config.ts";
import {crawlForSearchProfile} from "./utils/crawlForSearchProfile.ts";
import {writeFileSync} from "fs";
import {parseSearchPage} from "./utils/parseSearchPage.ts";

const client = await connectToDatabase()
const searchProfiles = await (collections.searchProfiles!!.find({}).toArray());

const startDate = new Date()
log.info(`Start: ${startDate.toLocaleString()}`);


await (collections.articles!!.updateMany({locationGeocoded: {}}, {$set: {locationGeocoded: null}}))

function handleArticle(searchKeyword: string, articleDb: Article | null, articleWeb: Article) {

    if (articleWeb.priceEur && articleWeb.priceEur > 10000) {
        // avoid crawling for buildings etc.
        log.info(`Skipping article href ${articleWeb.href}, price is > 10k eur`)
        return
    }

    if (articleDb) {
        if (!articleWeb.searchKeywords) {
            articleWeb.searchKeywords = []
        }

        if (!articleWeb.searchKeywords.includes(searchKeyword)) {
            articleWeb.searchKeywords.push(searchKeyword)
        }

        try {
            collections.articles?.updateMany({href: articleDb.href}, {
                $set: {
                    lastChecked: new Date(),
                    ...articleWeb,
                    ...articleDb,
                }
            }).then(
                (it) => {
                    log.debug(`Updated article (keywords), href ${articleWeb.href}, ${articleWeb.location}, ack ${it.acknowledged}`)
                }
            );
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    } else {
        // const locationGeocoded = geocodeLocation(articleWeb.location)
        try {
            collections.articles?.insertOne({
                ...articleWeb,
                //locationGeocoded,
                lastChecked: new Date(),
                searchKeywords: [searchKeyword]
            }).then( () => {
                log.info(`Inserted article, href https://ebay-kleinanzeigen.de${articleWeb.href}, ${articleWeb.location}, (${articleWeb.price})`)
            })
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    }
}

export async function searchRequestsToCrawl() {
    const searchRequests: SearchRequest[] = []
    for (const searchProfile of searchProfiles) {

        if (!searchProfile.isActive) {
            // log.info(`Skip: search profile '${searchProfile.title}', because not active`)
            continue

        }

        // log.info(`Found search profile '${searchProfile.title}'`)

        for (const searchKeyword of searchProfile.keywords) {

            if (DEBUG_SEARCH_KEYWORDS.length > 0 && !(DEBUG_SEARCH_KEYWORDS.includes(searchKeyword)))
                continue

            if (searchKeyword.startsWith("-"))
                continue

            if (ONLY_ALLOWED_KEYWORDS.length > 0 && !ONLY_ALLOWED_KEYWORDS.includes(searchKeyword))
                continue

            for (const searchLocation of searchProfile.locations) {
                const searchRequest = {
                    keyword: searchKeyword,
                    searchArea: searchLocation.searchArea,
                    searchDistance: searchLocation.searchDistance,
                    maxPrice: searchProfile.maxPrice
                }

                const foundSearchRequest = await collections.searchRequests!!.findOne(searchRequest);

                const diffInMinutesSearchRequest: number = foundSearchRequest?.lastSearch ? (Date.now() - new Date(foundSearchRequest?.lastSearch).getTime()) / (1000 * 60) : 0
                const doSearchSearchRequest = !foundSearchRequest?.lastSearch || diffInMinutesSearchRequest > MIN_TIME_BETWEEN_SEARCHES_MINUTES
                if (!doSearchSearchRequest && !FORCE_UPDATE) {
                    // TODO: tmp
                    // log.info(`Skip: search keyword '${searchRequest.keyword}', crawled ${diffInMinutesSearchRequest} minutest ago`)
                    continue
                }

                searchRequests.push(searchRequest)
            }
        }
    }

    return searchRequests
}

const searchPageHandler = async function (searchKeyword: string, content: string, spHref: string) {
    const splitted = spHref.split('/')
    const fileName = splitted.length == 0 ? 'unknown' : splitted.slice(3).join('-').replaceAll(':', '-')
    let searchPageFile = `search-pages/${fileName}.html`;
    writeFileSync(searchPageFile, content);

    const articles: Article[] = parseSearchPage(searchPageFile);

    log.info(`Articles found on the page ${spHref}: ${articles.length}`)
    for (const article of articles) {
        const articleDb = await collections.articles!!.findOne({href: article.href})
        handleArticle(searchKeyword, articleDb, article);
    }

    const searchRequest = await collections.searchRequests!!.findOne({keyword: searchKeyword});

    if (searchRequest?.lastSearch) {
        const articlesByKeyword = await collections.articles!!.find(
            {
                lastSearch: {
                    $exists: true,
                    $lt: searchRequest.lastSearch
                },
                searchKeywords: {
                    $in: [searchKeyword]
                }
            }).toArray()
        for (const article of articlesByKeyword) {
            console.log(`DELETE: ${article.href}`);
        }
    }
}


let numOfSearchRequests = (await searchRequestsToCrawl()).length
let retries = 1
while (numOfSearchRequests > 0) {
    log.info(`********************************************************************************`)
    log.info(`>>>> Try number ${retries}, search requests left: ${numOfSearchRequests} <<<<<`)
    log.info(`********************************************************************************`)

    await crawlForSearchProfile(searchPageHandler)
    retries++
    numOfSearchRequests = (await searchRequestsToCrawl()).length
}

let find = collections.articles!!.find();
const totalArticles = (await find.toArray()).length;
log.info(``)
log.info(`Total of ${totalArticles} in db now`)
log.info(``)


const endDate = new Date()
log.info(``)
log.info(`End: ${endDate.toLocaleString()}`);
const diffInMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
log.info(`Duration (minutes): ${diffInMinutes}`)

await client.close(true)

log.info(`>>> DONE <<<<`)
log.info(``)

