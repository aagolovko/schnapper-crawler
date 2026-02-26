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
import {parseSearchPage} from "./parseSearchPage.ts";
import {Article} from "../models/article";
import {SearchRequest} from "../models/searchRequest";

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

async function doSearchRequest(landing: SearchPage, searchRequest: SearchRequest) {
    log.info(`Enter UI search fields for keyword: ${searchRequest.keyword}`)
    await landing.inputSearchQuery(searchRequest.keyword)

    await sleep(PAUSE_MS)
    await landing.inputSearchArea(searchRequest.searchArea)

    await sleep(PAUSE_MS)
    await landing.inputSearchDistance(searchRequest.searchDistance)

    await sleep(PAUSE_MS * 2)
    await landing.submitSearch();

    await sleep(PAUSE_MS * 6)

    return await landing.getContent();
}

export async function crawling() {

    const requestQueue = await RequestQueue.open(`rq-${uuidv4()}`)


    const searchRequests = await findSearchRequests();

    log.info(`********************************************************************************`)
    log.info(`>>>> Search requests: ${searchRequests.length} <<<<<`)
    log.info(`********************************************************************************`)


        const crawlerConfig = {
        requestQueue,
        headless: DO_HEADLESS,
        requestHandler: browserPage
    } as PlaywrightCrawlerOptions;

    const crawler = new PlaywrightCrawler(crawlerConfig)
    await crawler.run([INITIAL_SEARCH_PAGE])
    //await crawler.teardown()

    // @ts-ignore
    async function browserPage({enqueueLinks, page, request}) {
        const isLandingPage = page.url() === INITIAL_SEARCH_PAGE
        const isSearchResultsPage = request.label === 'SEARCH_RESULTS'
        const isItemDetailsPage = false

        log.info(`Handling page: ${page.url()}`)

        if (isLandingPage) {
            // enter search request, submit, parse items
        } else if (isSearchResultsPage) {
            // only parse results
            const landing = new SearchPage(page);
            const searchRequest = request.userData?.searchRequest as SearchRequest;
            const url = await landing.getUrl();

            const searchPageFile = await cacheSearchResults(landing, searchRequest);

            const articles: Article[] = parseSearchPage(searchPageFile);
            log.info(`Articles found on the page ${url}: ${articles.length}`)

            for (const article of articles) {
                const articleDb = await collections.articles!!.findOne({href: article.href})
                handleArticle(searchRequest.keyword, articleDb, article);
            }

            const nextPages: string[] = await landing.nextPages()

            for (const url of nextPages) {
                await requestQueue.addRequest({
                    url,
                    label: 'SEARCH_RESULTS',
                    userData: {
                        searchRequest,
                    }
                });
            }
            return
        } else if (isItemDetailsPage) {
            // parse item details page and update
            // NOTE: we avoid it for now
            return
        }

        const landing = new SearchPage(page);
        // Helper to cache search result HTML to file and return URL and file path
        async function cacheSearchResults(landing: SearchPage, searchRequest: SearchRequest) {
            const url = await landing.getUrl();
            const splitted = url.split('/');
            const fileName = splitted.length <= 4 ? searchRequest.keyword : splitted.slice(3).join('-').replaceAll(':', '-');
            const searchPageFile = `search-pages/${fileName}.html`;
            const content = await landing.getContent();
            writeFileSync(searchPageFile, content);
            return searchPageFile;
        }
        await page.once('load', () => {});

        await sleep(PAUSE_MS)
        await sleep(PAUSE_MS)
        await landing.acceptCookies()

        await sleep(PAUSE_MS)
        await landing.closeWelcomePopup()

        for (const searchRequest of searchRequests) {
            const url = await landing.getUrl();
            await doSearchRequest(landing, searchRequest);
            const searchPageFile = await cacheSearchResults(landing, searchRequest);

            const articles: Article[] = parseSearchPage(searchPageFile);
            log.info(`Articles found on the page ${url}: ${articles.length}`)

            for (const article of articles) {
                const articleDb = await collections.articles!!.findOne({href: article.href})
                handleArticle(searchRequest.keyword, articleDb, article);
            }

            //     const summary = root.querySelector('.breadcrump-summary')?.innerText?.match(/(\d+)/gm).slice(0, 3)
            //     if (summary && summary.length == 3 && metaInfoHandler) {
            //         metaInfoHandler(Number(summary[0]), Number(summary[1]), Number(summary[2]))
            //     }

            // Update or insert the search request and handle any cleanup
            await updateOrInsertSearchRequest(searchRequest);

            const nextPages: string[] = await landing.nextPages()

            for (const url of nextPages) {
                await requestQueue.addRequest({
                    url,
                    label: 'SEARCH_RESULTS',
                    userData: {
                        searchRequest,
                    }
                });
            }
        }
    }
}

function handleArticle(searchKeyword: string, articleDb: Article | null, articleWeb: Article) {
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


