// For more information, see https://crawlee.dev/

import {parse} from 'node-html-parser';

import {log} from "crawlee";
import {Article} from '../models/article';
import * as fs from "fs";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function parseSearchPage(searchPagePath: string): Article[] {
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
        const priceEur = price ? parseInt(price.match(/\d/g)?.join('')) : 0
        const isShippingStr = el.querySelector('.aditem-main--middle--price-shipping--shipping')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const isShipping = isShippingStr != undefined ? true : false

        const href = el.querySelector('.text-module-begin a')?.getAttribute('href')
        const title = el.querySelector('.text-module-begin a')?.innerText

        articlesJson.push({
            href,
            hrefImage,
            location,
            priceEur,
            locationGeocoded: undefined, // calculated during saving to db, if articly not in db yet
            price,
            isShipping,
            title,
        })
    }

    return articlesJson
}


