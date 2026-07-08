import {log, PlaywrightCrawler} from 'crawlee';
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import {sleep} from "./utils.ts";
import {RequestQueue} from "apify";
import {v4 as uuidv4} from 'uuid';
import {
    DEBUG_SEARCH_KEYWORDS,
    DO_HEADLESS,
    FORCE_UPDATE,
    INITIAL_SEARCH_PAGE, MAX_SEARCH_PAGES_FOR_KEYWORD,
    MIN_TIME_BETWEEN_SEARCHES_MINUTES,
    ONLY_ALLOWED_KEYWORDS,
    PAUSE_MS
} from "../config.ts";
import {collections} from "../services/database.service.ts";
import {SearchPage} from "../pages/searchPage.ts";
import {writeFileSync} from "fs";
import {mkdirSync} from "fs";
import {parseSearchPage} from "./parseSearchPage.ts";
import type {Article} from "../models/article.ts";
import type {SearchRequest} from "../models/searchRequest.ts";

// Helper to insert or update a search request and perform cleanup of old articles
const updateOrInsertSearchRequest = async (searchRequest: SearchRequest) => {
    // Find existing request
    const prevSearchRequest = await collections.searchRequests!!.findOne(searchRequest);

    // If there is a previous search and it has a lastSearch timestamp, delete old articles
    if (searchRequest?.lastSearch) {
        const articlesByKeyword = await collections.articles!!.find({
            lastSearch: {
                $exists: true,
                $lt: searchRequest.lastSearch
            },
            searchKeywords: {
                $in: [searchRequest.keyword]
            }
        }).toArray();
        for (const article of articlesByKeyword) {
            console.log(`DELETE: ${article.href}`);
        }
    }

    // Upsert the search request with updated fields
    const updatedFields = {articlesFound: 0 /*TODO*/, lastSearch: new Date()};
    if (prevSearchRequest) {
        await collections.searchRequests!!.updateMany({_id: prevSearchRequest._id}, {$set: updatedFields});
    } else {
        await collections.searchRequests!!.insertOne({...searchRequest, ...updatedFields});
    }
};

const plz2InternalID: { [key: string]: string } = {
    "81375": "l6414"
}

export async function crawling() {

    const requestQueue = await RequestQueue.open(`rq-${uuidv4()}`)

    const searchRequests = await findSearchRequests();

    const searchUrls = searchRequests.map(searchRequest => {
        return {
            url: `https://www.kleinanzeigen.de/s-${searchRequest.searchArea}/${searchRequest.keyword}/k0${plz2InternalID[searchRequest.searchArea]}r${searchRequest.searchDistance}`,
            label: 'SEARCH_RESULTS',
            userData: { searchRequest: searchRequest }
        };
    });

    log.info(`********************************************************************************`)
    log.info(`>>>> Search requests: ${searchRequests.length} <<<<<`)
    log.info(`********************************************************************************`)


    const crawlerConfig = {
        requestQueue,
        headless: DO_HEADLESS,
        useSessionPool: false,
        maxRequestsPerCrawl: 200,
        minConcurrency: 1,
        maxConcurrency: 1,
        requestHandler: browserPage
    } as PlaywrightCrawlerOptions;

    const crawler = new PlaywrightCrawler(crawlerConfig)
    await crawler.run(searchUrls)
    //await crawler.teardown()

    // @ts-ignore
    async function browserPage({enqueueLinks, page, request}) {

        log.info(`Handling page: ${page.url()}`)

        await sleep(PAUSE_MS * 5)

        const landing = new SearchPage(page);

        // Helper to cache search result HTML to file and return URL and file path
        async function cacheSearchResults(landing: SearchPage, searchRequest: SearchRequest) {
            const url = await landing.getUrl();
            const splitted = url.split('/');
            const fileName = splitted.length <= 4 ? searchRequest.keyword : splitted.slice(3).join('-').replaceAll(':', '-');
            const searchPageFile = `search-pages/${fileName}.html`;
            mkdirSync("search-pages", {recursive: true});
            const content = await landing.getContent();
            writeFileSync(searchPageFile, content);
            return searchPageFile;
        }
        await page.once('load', () => {});

        const searchRequest = request.userData?.searchRequest as SearchRequest;
        const searchPageFile = await cacheSearchResults(landing, searchRequest);
        const articles: Article[] = parseSearchPage(searchPageFile);

        const url = await landing.getUrl();
        log.info(`Articles found on the page ${url}: ${articles.length}`)

        for (const article of articles) {
            const articleDb = await collections.articles!!.findOne({href: article.href})
            handleArticle(searchRequest.keyword, articleDb, article);
        }

        // Update or insert the search request and handle any cleanup
        await updateOrInsertSearchRequest(searchRequest);
    }
}

function handleArticle(searchKeyword: string, articleDb: Article | null, articleWeb: Article) {
    if (articleDb) {
        const searchKeywords = new Set([
            ...(articleDb.searchKeywords || []),
            ...(articleWeb.searchKeywords || []),
            searchKeyword,
        ]);
        const updateFields: Partial<Article> = {
            lastChecked: new Date(),
            hrefImage: articleWeb.hrefImage ?? articleDb.hrefImage,
            title: articleWeb.title ?? articleDb.title,
            price: articleWeb.price ?? articleDb.price,
            priceEur: articleWeb.priceEur ?? articleDb.priceEur,
            location: articleWeb.location ?? articleDb.location,
            createdOn: articleWeb.createdOn ?? articleDb.createdOn,
            isShipping: articleWeb.isShipping ?? articleDb.isShipping,
            locationGeocoded: articleWeb.locationGeocoded ?? articleDb.locationGeocoded,
            searchKeywords: Array.from(searchKeywords),
        };

        try {
            collections.articles?.updateMany({href: articleDb.href}, {
                $set: updateFields,
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
                log.debug(`Inserted article, href https://ebay-kleinanzeigen.de${articleWeb.href}, ${articleWeb.location}, (${articleWeb.price})`)
            })
        } catch (error) {
            log.error(`Failed ${error}`)
        }
    }
}

export async function findSearchRequests() {
    const searchProfiles = await (collections.searchProfiles!!.find({}).toArray());
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
