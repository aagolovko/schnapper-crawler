import {writeFileSync} from 'fs';
import {collections, connectToDatabase} from "./services/database.service.ts";
import {crawlForSearchProfile} from "./utils/crawlForSearchProfile.ts";
import {log} from "crawlee";
import {sleep} from "./utils/utils.ts";
import {parseSearchPage} from "./utils/parseSearchPage.ts";
import {Article} from "./models/article";

import {SearchRequest} from "./models/searchRequest";
import {geocodeLocation} from "./utils/geocoding.ts";

const client = await connectToDatabase()
const found = await collections.searchProfiles.find({});
const searchProfiles = await found.toArray();

let searchRequestsCounter = 0

const STOP_CRAWLING = true
export const PAUSE_MS = 1000
/* use next variables for debugging. The array containes keywords, which are
* only allowed to be used in searches.*/
const FORCE_UPDATE = false
const DEBUG_SEARCH_KEYWORDS: string[] = [] // ['balken']
export const DO_HEADLESS = false

// minimal pause between single search requests
const MIN_TIME_BETWEEN_SEARCHES_MINUTES = 360 // 360

const searchRequests: any = []
for (const searchProfile of searchProfiles) {
    for (const searchKeyword of searchProfile.keywords) {
        for (const searchLocation of searchProfile.locations) {
            const searchRequest: SearchRequest = {
                keyword: searchKeyword,
                searchArea: searchLocation.searchArea,
                searchDistance: searchLocation.searchDistance,
                maxPrice: searchProfile?.maxPrice
            }

            searchRequests.push(searchRequest)
        }
    }
}

const startDate = new Date()
log.info(``)
log.info(``)
log.info(`Going to issue for ${searchRequests.length} search requests`)
log.info(`Start: ${startDate.toLocaleString()}`);
log.info(``)
log.info(``)

const updateOrInsert = async (found: any, object: any, updatedFields: any) => {
    if (found) {
        await collections.searchRequests.updateOne({_id: found._id}, {$set: updatedFields})
    } else {
        await collections.searchRequests.insertOne({...object, ...updatedFields})
    }
}

async function handleArticle(searchKeyword, found, article) {

    if (article.priceEur > 10000) {
        // avoid crawling for buildings etc.
        log.info(`Skipping article href ${article.href}, price is > 10k eur`)
        return
    }

    if (found) {

        return

        if (!article.searchKeywords) {
            article.searchKeywords = []
        }

        if (!article.searchKeywords.includes(searchKeyword)) {
            article.searchKeywords.push(searchKeyword)
        }

        log.info(`Update article (keywords), href ${article.href}, ${article.location}`)

        try {
            await collections.articles?.updateOne({_id: found._id}, {$set: {...found, ...article}})
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    } else {
        log.info(`Insert article, href https://ebay-kleinanzeigen.de${article.href}, ${article.location}`)
        const locationGeocoded = await geocodeLocation(article.location)
        try {
            await collections.articles?.insertOne({...article, locationGeocoded, searchKeywords: [searchKeyword]})
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    }
}

for (const searchProfile of searchProfiles) {

    if (!searchProfile.isActive) {
        log.info(`Skip: search profile '${searchProfile.title}', because not active`)
        continue

    }

    log.info(`Found search profile '${searchProfile.title}'`)

    for (const searchKeyword of searchProfile.keywords) {

        if (DEBUG_SEARCH_KEYWORDS.length > 0 && !(DEBUG_SEARCH_KEYWORDS.includes(searchKeyword)))
            continue

        if (searchKeyword.startsWith("-"))
            continue

        for (const searchLocation of searchProfile.locations) {
            const searchRequest = {
                keyword: searchKeyword,
                searchArea: searchLocation.searchArea,
                searchDistance: searchLocation.searchDistance,
                maxPrice: searchProfile.maxPrice
            }

            const foundSearchRequest = await collections.searchRequests.findOne(searchRequest);

            const diffInMinutesSearchRequest: number = foundSearchRequest?.lastSearch ? ((Date.now() - new Date(foundSearchRequest?.lastSearch).getTime())/(1000 * 60)).toFixed() : 0
            const doSearchSearchRequest = !foundSearchRequest?.lastSearch || diffInMinutesSearchRequest > MIN_TIME_BETWEEN_SEARCHES_MINUTES
            if (!doSearchSearchRequest && !FORCE_UPDATE) {
                log.info(`Skip: search keyword '${searchRequest.keyword}', crawled ${diffInMinutesSearchRequest} minutest ago`)
                continue
            }

            searchRequestsCounter++

            let totalArticlesBySearchRequest: number
            log.info(`[${searchRequestsCounter.toString().padStart(3, '0')}/${searchRequests.length.toString().padStart(3, '0')}]: Search request ${JSON.stringify(searchRequest)}`)
            await crawlForSearchProfile(searchRequest, async (content: string, spHref: string): boolean => {
                const splitted = spHref.split('/')
                const fileName = splitted.length == 0 ? 'unknown' : splitted.slice(3).join('-').replaceAll(':', '-')
                let searchPageFile = `search-pages/${fileName}.html`;
                writeFileSync(searchPageFile, content);

                const articles: Article[] = await parseSearchPage(searchPageFile, (from, to, totalFoundCounter) => {
                    log.info(`Processing articles [${from} - ${to}] of ${totalFoundCounter}`)
                    if (!totalArticlesBySearchRequest) {
                        totalArticlesBySearchRequest = totalFoundCounter
                    }
                });

                let handledArticleCounter = 0
                for (const article of articles) {
                    const found = await collections.articles.findOne({href: article.href});

                    // // we assume articles are ordered by time in search page
                    // // so it is safe to skip the rest of results without loosing anything
                    // if (found && !FORCE_UPDATE) {
                    //     if (handledArticleCounter == 0) {
                    //         log.info(`\x1B[34mNo new articles`)
                    //     } else {
                    //         log.info(`\x1B[31mNew articles found: ${handledArticleCounter}`)
                    //     }
                    //
                    //     return STOP_CRAWLING
                    // }
                    handledArticleCounter++
                    await handleArticle(searchKeyword, found, article);
                }

                return !STOP_CRAWLING
            })

            await updateOrInsert(foundSearchRequest, searchRequest, {articlesFound: totalArticlesBySearchRequest, lastSearch: new Date()})

            // await updateOrInsert(foundSearchRequest, searchRequest, {lastSearch: new Date()})
            await sleep(1000)
        }
    }

    log.info(``)
    log.info(``)
}

let find = await collections.articles.find();
const totalArticles = (await find.toArray()).length;
log.info(``)
log.info(`Total of ${totalArticles} in db now`)
log.info(``)


const endDate = new Date()
log.info(``)
log.info(`End: ${endDate.toLocaleString()}`);
const diffInMinutes = (endDate.getTime() - startDate.getTime())/(1000*60)
log.info(`Duration (minutes): ${diffInMinutes}`)

log.info(`>>> DONE <<<<`)
log.info(``)

