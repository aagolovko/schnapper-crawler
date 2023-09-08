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


/*
*
* article which are brettspiel (case insensitive
*       {title: {$regex: 'brettspiel', $options: 'i'}}
*       {title: {$regex: 'Surfbrett', $options: 'i'}}
*
*
* {_id: ObjectId('64ca6de53bcf2c464d589c62')}
* {href: '/s-anzeige/trixie-fahrradanhaenger-inkl-kupplung/2507695309-217-6453'}
*
* with wrong image HREF
*       {hrefImage: {$regex: " 2x"}}
* */

// NOTE: use the code to convert/update fields of articles
// const updateMe: Article[] = await (await collections.articles.find(
//     {title: {$regex: 'trittbrett', $options: 'i'}}
// )).toArray();
// for (const a of updateMe) {
//     await collections.articles.updateOne({_id: a._id}, {$set: {isIgnored: true}})
// }

// const updateMe: Article[] = await (await collections.articles.find(
//     {isIgnored: {$exists: false}}
// )).toArray();
// for (const a of updateMe) {
//     if (!a.isFavorite) {
//         await collections.articles.deleteOne({_id: a._id})
//     }
// }

let searchRequestsCounter = 0

const STOP_CRAWLING = true
export const PAUSE_MS = 1000
/* use next variables for debugging. The array containes keywords, which are
* only allowed to be used in searches.*/
const FORCE_UPDATE = false
const DEBUG_SEARCH_KEYWORDS: string[] = [] // ['balken']
export const DO_HEADLESS = true

// minimal pause between single search requests
const MIN_TIME_BETWEEN_SEARCHES_MINUTES = 360

const searchRequests: any = []
for (const searchProfile of searchProfiles) {
    if (!searchProfile?.isActive)
        continue
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

async function handleArticle(searchKeyword, found, article) {
    if (found) {

        let doUpdate = false
        if (!article.searchKeywords?.includes(searchKeyword)) {
            if (!article.searchKeywords) {
                article.searchKeywords = [searchKeyword]
            } else {
                article.searchKeywords.push(searchKeyword)
            }
            doUpdate = true
        }

        if (!found.locationGeocoded && FORCE_UPDATE) {
            const locationGeocoded = await geocodeLocation(article.location)
            article.locationGeocoded = locationGeocoded
            doUpdate = true
        }

        if (doUpdate) {
            log.info(`Update (force) article, href ${article.href}`)

            try {
                await collections.articles?.updateOne({_id: found._id}, {$set: {...found, ...article}})
            } catch (error) {
                log.error(`Failed ${error}`)
            }
        }
    } else {
        article.searchKeywords = [searchKeyword]
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

        if (DEBUG_SEARCH_KEYWORDS.length > 0 && !(DEBUG_SEARCH_KEYWORDS.includes(searchKeyword)))
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

