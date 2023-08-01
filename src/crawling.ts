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

let counter = 0

const STOP_CRAWLING = true

// set true, if you want to update already existing articles
const FORCE_UPDATE = false

// for search profile
const MIN_TIME_BETWEEN_SEARCHES_MINUTES = 60

const searchRequests: any = []
for (const searchProfile of searchProfiles) {

    log.info(`Found search profile '${searchProfile.title}'`)

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

log.info(``)
log.info(``)
log.info(`Going to issue for ${searchRequests.length} search requests`)
log.info(``)
log.info(``)

async function handleArticle(found, article) {
    if (found) {
        try {
            await collections.articles?.updateOne({_id: found._id}, {$set: {priceEur: article.priceEur}})
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    } else if (found && found.locationGeocoded == undefined) {
        log.info(`Update article with geolocation, href ${article.href}`)

        const locationSplitted = article.location.split('-')

        let locationStr = (locationSplitted.length > 0) ? locationSplitted[0].trim() : article.location
        let locationGeocoded = (await geocoder.geocode(locationStr)).slice(-1).at(0)

        if (!locationGeocoded && locationStr) {
            locationStr = locationStr.split(' ')[0].trim()
            locationGeocoded = (await geocoder.geocode(`${locationStr} Germany`)).slice(-1).at(0)
        }

        if (locationGeocoded) {
            try {
                await collections.articles?.updateOne({_id: found._id}, {$set: {locationGeocoded}})
            } catch (error) {
                log.error(`Failed ${error}`)
            }
        } else {
            log.info(`Failed to resolve location for '${locationStr}', derived from '${article.location}'`)
        }
    } else if (!found) {
        log.info(`Insert article with href ${article.href}`)
        const locationGeocoded = (await geocoder.geocode(article.location)).slice(-1).at(0)
        try {
            article.locationGeocoded = locationGeocoded
            await collections.articles?.insertOne(article)
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    } else {
        log.debug(`Skipping article with href ${article.href}`)
    }
}

for (const searchProfile of searchProfiles) {

    log.info(`Found search profile '${searchProfile.title}'`)

    const diffInMinutes: number = (Date.now() - searchProfile.lastSearch)/(1000 * 60)
    const doSearch = !searchProfile.lastSearch || diffInMinutes > MIN_TIME_BETWEEN_SEARCHES_MINUTES
    if (!doSearch) {
        log.info(`Search profile '${searchProfile.title}' skipped, cralled ${diffInMinutes.toFixed()} minutest ago`)
        continue
    }

    for (const searchKeyword of searchProfile.keywords) {
        for (const searchLocation of searchProfile.locations) {
            const searchRequest = {
                keyword: searchKeyword,
                searchArea: searchLocation.searchArea,
                searchDistance: searchLocation.searchDistance,
                maxPrice: searchProfile.maxPrice
            }

            counter++

            log.info(`[${counter.toString().padStart(3, '0')}/${searchRequests.length.toString().padStart(3, '0')}]: Search request ${JSON.stringify(searchRequest)}`)
            await crawlForSearchProfile(searchRequest, async (content: string, spHref: string): boolean => {
                const splitted = spHref.split('/')
                const fileName = splitted.length == 0 ? 'unknown' : splitted.slice(3).join('-').replaceAll(':', '-')
                let searchPageFile = `search-pages/${fileName}.html`;
                writeFileSync(searchPageFile, content);

                const articles: Article[] = await parseSearchPage(searchPageFile);
                let newArticlesCounter = 0
                for (const article of articles) {
                    const found = await collections.articles.findOne({href: article.href});

                    if (found && !FORCE_UPDATE) {
                        log.info(`Skipping search request after ${newArticlesCounter} items`)
                        // we assume articles are ordered by time in search page
                        // so it is safe to skip the rest of results without loosing anything
                        return STOP_CRAWLING
                    }
                    newArticlesCounter++
                    await handleArticle(found, article);
                }

                return !STOP_CRAWLING
            })


            await sleep(5000)
        }
    }

    try {
        await collections.searchProfiles?.updateOne({_id: searchProfile._id}, {$set: {lastSearch: Date.now()}})
    } catch (error) {
        log.error(`Failed ${error}`)
    }
}

let find = await collections.articles.find();
const totalArticles = (await find.toArray()).length;
log.info(``)
log.info(`Total of ${totalArticles} in db now`)
log.info(``)

await client.close()

log.info(``)
log.info(`>>> DONE <<<<`)
log.info(``)

