// For more information, see https://crawlee.dev/

import {readdirSync, readFileSync, writeFileSync} from "fs";
import path from "path";
import {Article} from "./models/article";
import {FeatureCollection, GeoJSON} from "geojson";
import { toKML } from "@placemarkio/tokml";
import {log} from "crawlee";
import {collections, connectToDatabase} from "./services/database.service.ts";

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

const client = await connectToDatabase()

let articles = await (await collections.articles.find()).toArray();

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

const kml = toKML(geoJson)

writeFileSync(`output/mongodb.kml`, kml)
writeFileSync(`output/mongodb.geo.json`, JSON.stringify(geoJson, null, 4))

await client.close()

console.log(`Done`)


