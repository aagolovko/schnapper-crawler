import {writeFileSync} from 'fs';
import {collections, connectToDatabase} from "./services/database.service.ts";
import {crawlForSearchProfile} from "./utils/crawler.ts";
import {log} from "crawlee";
import {sleep} from "./utils/utils.ts";
import {parseSearchPage} from "./utils/parser.ts";
import {Article} from "./models/article";

import NodeGeocoder from 'node-geocoder';
import node_geocoder from 'node-geocoder';
import {SearchRequest} from "./models/searchRequest";

const options: node_geocoder.Options = {
    provider: 'openstreetmap'
};

const geocoder = NodeGeocoder(options);

const client = await connectToDatabase()
const found = await collections.searchProfiles.find({});
const searchProfiles = await found.toArray();


// NOTE: use the code to convert/update fields of articles
// const updateMe: Article[] = await (await collections.articles.find({hrefImage: {$regex: " 2x"}})).toArray();
// for (const a of updateMe) {
//     const hrefImageNew = a.hrefImage?.replace(/ 2x/gi, '').trim()
//     await collections.articles.updateOne({_id: a._id}, {$set: {hrefImage: hrefImageNew}})
// }

let searchRequestsCounter = 0

const STOP_CRAWLING = true

/* use next variables for debugging. The array containes keywords, which are
* only allowed to be used in searches.*/
const FORCE_UPDATE = false
const DEBUG_SEARCH_KEYWORDS: string[] = [] // ['balken']
export const DO_HEADLESS = true

// minimal pause between single search requests
const MIN_TIME_BETWEEN_SEARCHES_MINUTES = 360

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
    if (found && found._id) {
        await collections.searchRequests.updateOne({_id: found?._id}, {$set: updatedFields})
    } else {
        await collections.searchRequests.insertOne({...object, ...updatedFields})
    }
}

async function geocodeLocation(location: string) {
    const locationSplitted = location.split('-')

    let locationStr = (locationSplitted.length > 0) ? locationSplitted[0].trim() : location
    let locationGeocoded
    try {
        locationGeocoded = (await geocoder.geocode(locationStr)).slice(-1).at(0)
    } catch (e) {
        log.warning(`geocodeLocation ${e}`)
    }

    if (locationStr && !locationGeocoded) {
        locationStr = locationStr.split(' ')[0].trim()
        try {
            locationGeocoded = (await geocoder.geocode(`${locationStr} Germany`)).slice(-1).at(0)
        } catch (e) {
            log.warning(`geocodeLocation ${e}`)
        }
    }

    if (!locationGeocoded) {
        log.warning(`Failed to resolve location for '${locationStr}', derived from '${location}'`)
    }

    return locationGeocoded
}

async function handleArticle(found, article) {
    if (found) {
        if (FORCE_UPDATE) {
            log.info(`Update (force) article, href ${article.href}`)

            if (!found.locationGeocoded) {
                const locationGeocoded = await geocodeLocation(article.location)
                article.locationGeocoded = locationGeocoded
            }

            try {
                await collections.articles?.updateOne({_id: found._id}, {$set: {...found, ...article}})
            } catch (error) {
                log.error(`Failed ${error}`)
            }
        } else {
            log.debug(`Skipping article with href ${article.href}`)
        }
    } else {
        log.info(`Insert article, href ${article.href}`)
        const locationGeocoded = await geocodeLocation(article.location)
        try {
            await collections.articles?.insertOne({...article, locationGeocoded})
        } catch (error) {
            log.error(`Failed ${error}`)
        }

    }
}

for (const searchProfile of searchProfiles) {

    log.info(`Found search profile '${searchProfile.title}'`)

    for (const searchKeyword of searchProfile.keywords) {

        if (DEBUG_SEARCH_KEYWORDS.length >0 && !(DEBUG_SEARCH_KEYWORDS.includes(searchKeyword)))
            continue

        for (const searchLocation of searchProfile.locations) {
            const searchRequest = {
                keyword: searchKeyword,
                searchArea: searchLocation.searchArea,
                searchDistance: searchLocation.searchDistance,
                maxPrice: searchProfile.maxPrice
            }

            const found = await collections.searchRequests.findOne(searchRequest);

            const diffInMinutesSearchRequest: number = found?.lastSearch ? ((Date.now() - new Date(found?.lastSearch).getTime())/(1000 * 60)).toFixed() : 0
            const doSearchSearchRequest = !found?.lastSearch || diffInMinutesSearchRequest > MIN_TIME_BETWEEN_SEARCHES_MINUTES
            if (!doSearchSearchRequest && !FORCE_UPDATE) {
                log.info(`Search keyword '${searchRequest.keyword}' skipped, crawled ${diffInMinutesSearchRequest} minutest ago`)
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

                await updateOrInsert(found, searchRequest, {articlesFound: totalArticlesBySearchRequest})

                let handledArticleCounter = 0
                for (const article of articles) {
                    const found = await collections.articles.findOne({href: article.href});

                    if (found && !FORCE_UPDATE) {
                        if (handledArticleCounter == 0) {
                            log.info(`\x1B[34mNo new articles`)
                        } else {
                            log.info(`\x1B[31mNew articles found: ${handledArticleCounter}`)
                        }

                        // we assume articles are ordered by time in search page
                        // so it is safe to skip the rest of results without loosing anything
                        return STOP_CRAWLING
                    }
                    handledArticleCounter++
                    await handleArticle(found, article);
                }

                return !STOP_CRAWLING
            })

            await updateOrInsert(found, searchRequest, {lastSearch: new Date()})
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

