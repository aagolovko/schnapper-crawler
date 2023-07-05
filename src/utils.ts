import { PlaywrightCrawler, Dataset } from 'crawlee';
import {PlaywrightCrawlerOptions} from "@crawlee/playwright/internals/playwright-crawler";
import { writeFileSync } from 'fs';
import {connectToDatabase, collections} from "./services/database.service.ts";
import {log} from "crawlee";
import {SearchProfile} from "./models/searchProfile";

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const searchPageNumber = (url: string) => {
    let searchPageNum = 1

    if (!url.includes('seite:')) {
        // first search page
        return  1
    } else {
        let urlSplitted = url.split('/');
        searchPageNum = urlSplitted[4]?.split(':').at(1)
    }

    return searchPageNum
};

export const pad = (num, size) => {
    num = num.toString();
    while (num.length < size) num = "0" + num;
    return num;
}
