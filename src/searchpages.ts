// For more information, see https://crawlee.dev/

import {parse} from 'node-html-parser';

import {log} from "crawlee";
import {Article} from 'models/article';
import {readdir, readdirSync, readFileSync, readSync, writeFileSync} from "fs";
import path from "path";
import * as fs from "fs";

import NodeGeocoder from 'node-geocoder';
import node_geocoder from "node-geocoder";
import {Article} from "./models/article";
import {connectToDatabase, collections} from "./services/database.service.ts";

const options: node_geocoder.Options = {
    provider: 'openstreetmap'
};

const geocoder = NodeGeocoder(options);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const searchPagesDir = 'search-pages/'

async function parseSearchPage(searchPagePath: string): Article[] {
    const searchPageContent = fs.readFileSync(searchPagePath, 'utf8')

    log.info(`Content of ${searchPagePath}`);

    const root = parse(searchPageContent)
    const articles = root.querySelectorAll('article')

    const articlesJson: Article[] = []

    for (const el of articles) {

        sleep(1000)

        // example:
        // const location = "81475 München - Thalk.Obersendl.-Forsten-Fürstenr.-Solln"
        const location: String = el.querySelector('div .aditem-main--top--left i')?.nextSibling.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').replace(/\(.*\)+/gi, ' ').trim()

        const createdOn = el.querySelector('div .aditem-main--top--right i')?.nextSibling.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const hrefImage = el.querySelector('img')?.getAttribute('src')

        const price = el.querySelector('.aditem-main--middle--price-shipping--price')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const isShippingStr = el.querySelector('.aditem-main--middle--price-shipping--shipping')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const isShipping = isShippingStr != undefined ? true : false

        const href = el.querySelector('.text-module-begin a')?.getAttribute('href')
        const title = el.querySelector('.text-module-begin a')?.innerText

        articlesJson.push({
            href,
            hrefImage,
            location,
            locationGeocoded: undefined,
            price,
            isShipping,
            title,
        })
    }

    return articlesJson
}

const files = readdirSync(searchPagesDir)
const articles: Article[] = []

for (const file of files) {
    const filePath = path.join(searchPagesDir, file);
    let articlesJson = await parseSearchPage(filePath);
    articles.push(...articlesJson)
}

const client = await connectToDatabase()

for (const article of articles) {
    const found = await collections.articles.findOne({href: article.href});
    // const found = await collections.articles.findOne({href: "/s-anzeige/garantia-wasserhahn-auslaufset-regentonne-dichtungen/2410476962-89-6542"})

    // Note: modify the node where the image is set
    const forceUpdate = true

    if (found && forceUpdate) {
        try {
            await collections.articles?.updateOne({_id: found._id}, { $set: { hrefImage: article.hrefImage } })
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
                await collections.articles?.updateOne({_id: found._id}, { $set: { locationGeocoded } })
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

let find = await collections.articles.find();
const totalArticles = (await find.toArray()).length;
log.info(``)
log.info(`Total of ${totalArticles} in db now`)
log.info(``)

await client.close()

// writeFileSync('search-pages-json/articles.json', JSON.stringify(articles, null, 4))
log.info(`Done`)


