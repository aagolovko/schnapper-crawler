// For more information, see https://crawlee.dev/

import {parse} from 'node-html-parser';

import {log} from "crawlee";
import type {Article} from '../models/article.ts';
import * as fs from "fs";
import {WAIT_FOR_SELECTOR} from "../config.ts";

// TODO: do we need to save? xpath query directly in browser.
export function parseSearchPage(searchPagePath: string): Article[] {
    const searchPageContent = fs.readFileSync(searchPagePath, 'utf8')

    const root = parse(searchPageContent)

    const summary = root.querySelector('.breadcrump-summary')?.innerText?.match(/(\d+)/gm)?.slice(0, 3)
    if (summary && summary.length == 3) {
        const from = Number(summary[0])
        const to = Number(summary[1])
        const total = Number(summary[2])
        log.info(`Processing articles [${from} - ${to}] of ${total}`)
    }

    const articles = root.querySelectorAll('#srchrslt-adtable article')

    const articlesJson: Article[] = []

    for (const el of articles) {
        const href = el.getAttribute("data-href")
            || el.querySelector('h3 a')?.getAttribute('href')
            || el.querySelector('.text-module-begin a')?.getAttribute('href')
            || el.querySelector('.text-module-begin span')?.getAttribute('data-url')
        log.debug(`Handling article with href ${href}`);

        const hrefImageTry1 = el.querySelector('img')?.getAttribute('src')?.replace(/ 2x/gi, '').trim()
        const hrefImageTry2 = el.querySelector('.imagebox')?.getAttribute('data-imgsrcretina')?.replace(/ 2x/gi, '').trim()
        const hrefImage = hrefImageTry2 ? hrefImageTry2 : hrefImageTry1
        if (!hrefImage) {
            log.debug(`Failed to resolve hrefImage for ${href}`);
        }

        const location = el.querySelector('svg[data-title="locationOutline"] + span')?.textContent?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').replace(/\(.*\)+/gi, ' ').trim()
            || el.querySelector('div .aditem-main--top--left i')?.nextSibling?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').replace(/\(.*\)+/gi, ' ').trim()

        let createdOn = el.querySelector('.aditem-main--top--right i')?.nextSibling?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()

        if (!createdOn) {
            createdOn = el
                .querySelector('svg[data-title="calendarOutline"] + span')
                ?.textContent
                .trim();
        }
        if (!createdOn) {
            log.warning(`Failed to resolve "createdOn", href ${href}`);
            continue
        }

        let createdOnSplitted = createdOn ? createdOn.split(',') : []
        let createdOnDate = new Date()
        if (createdOnSplitted.length == 2) {
            const hoursMinutes = createdOnSplitted[1].trim().split(':')
            createdOnDate.setHours(parseInt(hoursMinutes[0]))
            createdOnDate.setMinutes(parseInt(hoursMinutes[1]))

            if (createdOnSplitted[0] == "Gestern") {
                createdOnDate = new Date(createdOnDate.getTime() - 24 * 60 * 60 * 1000)
            } else if (createdOnSplitted[0] == "Heute") {
                // do nothing
            }
        } else {
            createdOnSplitted = createdOn.split('.')
            createdOnDate.setDate(parseInt(createdOnSplitted[0]))
            createdOnDate.setMonth(parseInt(createdOnSplitted[1]) - 1)
            createdOnDate.setFullYear(parseInt(createdOnSplitted[2]))
            createdOnDate.setHours(0)
            createdOnDate.setMinutes(0)
            createdOnDate.setSeconds(0)
        }

        const price = el.querySelector('.aditem-main--middle--price-shipping--price')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const pricePruned = price?.match(/\d/g)?.join('')
        const priceEur = pricePruned ? parseInt(pricePruned) : 0
        const isShippingStr = el.querySelector('.aditem-main--middle--price-shipping--shipping')?.innerText?.replace(/\n/gi, ' ').replace(/\s+/gi, ' ').trim()
        const isShipping = isShippingStr != undefined ? true : false


        let title = el.querySelector('h3 a')?.textContent?.trim()
        if (!title) {
            title = el.querySelector('.text-module-begin a')?.innerText
        }
        if (!title) {
            title = el.querySelector('.text-module-begin span')?.innerText
        }
        if (href && location && title) {
            articlesJson.push({
                href,
                hrefImage,
                location,
                priceEur,
                locationGeocoded: undefined, // calculated during saving to db, if articly not in db yet
                price,
                isShipping,
                title,
                searchKeywords: [],
                createdOn: createdOnDate
            })
        } else {
            log.warning(`Either href/location/title: ${href}/${location}/${title}`);
        }
    }

    return articlesJson
}
