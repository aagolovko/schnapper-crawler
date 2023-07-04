// For more information, see https://crawlee.dev/

import {readdirSync, readFileSync, writeFileSync} from "fs";
import path from "path";
import {Article} from "./searchpages";
import {FeatureCollection, GeoJSON} from "geojson";
import { toKML } from "@placemarkio/tokml";
import {log} from "crawlee";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function articleToFeature(article: Article) {
    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [article.locationGeocoded.longitude, article.locationGeocoded.latitude],
        },
        properties: {
            title: article.title,
            location: article.location,
            price: article.price,
            href: `https://www.kleinanzeigen.de${article.href}`
        }
    }
}

const articlesDir = 'search-pages-json'
const files = readdirSync(articlesDir)

files.forEach(file => {
    const filePath = path.join(articlesDir, file);

    const articlesStr = readFileSync(filePath)
    const articles: Article[] = JSON.parse(articlesStr)

    const features: [] = []

    for (const article of articles) {

        if (!article.locationGeocoded?.longitude || !article.locationGeocoded?.latitude) {
            log.warning(`No location for article ${article.href}, skipping`)
            continue
        }

        features.push(articleToFeature(article))
    }

    const geoJson: FeatureCollection = {
        type: "FeatureCollection",
        features
    }

    const y = toKML(geoJson)

    writeFileSync(`kml/${file.split('.').shift()}.kml`, y)
    writeFileSync(`geo/${file.split('.').shift()}.geo.json`, JSON.stringify(geoJson, null, 4))
});



console.log(`Done`)


