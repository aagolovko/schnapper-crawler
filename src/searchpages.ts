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

        const location = el.querySelector('div .aditem-main--top--left i')?.nextSibling.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').replace(/\(.*\)+/gi, ' ').trim()

        const createdOn = el.querySelector('div .aditem-main--top--right i')?.nextSibling.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const linkImage = el.querySelector('.aditem-image a div')?.getAttribute('data-imgsrc')

        const price = el.querySelector('.aditem-main--middle--price-shipping--price')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const isShippingStr = el.querySelector('.aditem-main--middle--price-shipping--shipping')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const isShipping = isShippingStr != undefined ? true : false

        const href = el.querySelector('.text-module-begin a')?.getAttribute('href')
        const title = el.querySelector('.text-module-begin a')?.innerText

        articlesJson.push({
            href,
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
    const found = await collections.articles.find({href: article.href});
    const dbArticles = await found.toArray();
    if (dbArticles.length == 0) {
        const locationGeocoded = (await geocoder.geocode(article.location)).slice(-1).at(0)
        try {
            article.locationGeocoded = locationGeocoded
            await collections.articles.insertOne(article)
        } catch (error) {
            log.error(`Failed ${error}`
            )
        }
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


