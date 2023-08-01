// For more information, see https://crawlee.dev/

import {parse} from 'node-html-parser';

import {log} from "crawlee";
import {Article} from '../models/article';
import * as fs from "fs";

export async function parseSearchPage(searchPagePath: string, metaInfoHandler?: (from: number, to: number, totalFoundCounter: number) => void): Article[] {
    const searchPageContent = fs.readFileSync(searchPagePath, 'utf8')

    log.info(`Content of ${searchPagePath}`);


    const root = parse(searchPageContent)
    const summary = root.querySelector('.breadcrump-summary')?.innerText?.match(/(\d+)/gm).slice(0, 3)
    if (summary && summary.length == 3 && metaInfoHandler) {
        metaInfoHandler(Number(summary[0]), Number(summary[1]), Number(summary[2]))
    }
    const articles = root.querySelectorAll('article')

    const articlesJson: Article[] = []

    for (const el of articles) {

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


