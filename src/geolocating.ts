import {collections, connectToDatabase} from "./services/database.service.ts";
import {Article} from "./models/article";
import {log} from "crawlee";
import {batchGeocodeLocations} from "./utils/geocoding.ts";

const client = await connectToDatabase()

const startDate = new Date()

// set locations to null, where locationGeocoded is set to empty object
await collections.geocodingLocations!!.updateMany({locationGeocoded: {}}, {$set: {locationGeocoded: null}} )

// find articles, for which not location is known
const articlesWithoutGeocoding: Article[] = await (collections.articles!!.find({locationGeocoded: null})).toArray();

const unknownLocations: string[] = articlesWithoutGeocoding
    .map(a => a.location)
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .filter((value) => value !== undefined)

const uncachedGeolocations: string[] = []
for (const articleLocationString of unknownLocations) {
    const locationGeocoded = await collections.geocodingLocations!!.findOne({locationString: articleLocationString})
    if (locationGeocoded?.locationOsm == null) {
        uncachedGeolocations.push(articleLocationString)
    }
}

// LIMIT BECAUSE OF API LIMIT
const unknownGeolocationsRequested: string[] = uncachedGeolocations.slice(0, 30)


log.info(``)
log.info(`Going to geocode locations for ${articlesWithoutGeocoding.length} articles`)
log.info(`Going to geocode for ${unknownGeolocationsRequested.length} unique and unknown yet locations`)
log.info(`Start: ${startDate.toLocaleString()}`);

const geocoded = unknownGeolocationsRequested.length > 0 ? await batchGeocodeLocations(unknownGeolocationsRequested) : []

const failedLocations = new Map<string, string>();
for (const responseIndex in unknownGeolocationsRequested) {
    let geocodingRequest = unknownGeolocationsRequested[responseIndex];
    const geocodingResponse = geocoded[responseIndex]?.value?.shift()

    if (!geocodingResponse) {
        log.warning(`Failed geocoding for location "${geocodingRequest}", retrying with "xxxxx Germany"`)
        const match = geocodingRequest.match(/\d+/)
        if (match) {
            failedLocations.set(geocodingRequest, `${match[0]} Germany`)
        }
    } else {
        await collections.geocodingLocations!!.insertOne({
            locationString: geocodingRequest,
            locationOsm: geocodingResponse
        })
    }
}

const sortedKeys = Array.from(failedLocations.keys()).sort();
const unknownGeolocationsRetried = sortedKeys.map( key => failedLocations.get(key)!!)
const geocodedRetry = unknownGeolocationsRetried.length > 0 ? await batchGeocodeLocations(unknownGeolocationsRetried) : []
for (const responseIndex in unknownGeolocationsRetried) {
    let geocodingRequest = unknownGeolocationsRetried[responseIndex];
    const geocodingResponse = geocodedRetry[responseIndex]?.value?.shift()

    if (!geocodingResponse) {
        log.warning(`Secondly failed geocoding for location "${geocodingRequest}" / "${sortedKeys[responseIndex]}"`)
    } else {
        await collections.geocodingLocations!!.insertOne({
            locationString: sortedKeys[responseIndex],
            locationOsm: geocodingResponse
        })
    }
}


for (const articlesIndex in articlesWithoutGeocoding) {
    let locationStr = articlesWithoutGeocoding[articlesIndex].location;
    let articleHref = articlesWithoutGeocoding[articlesIndex].href;
    let articleId = articlesWithoutGeocoding[articlesIndex]._id;

    const existingLocGeocoding = await collections.geocodingLocations!!.findOne({locationString: locationStr});
    if (existingLocGeocoding && !articlesWithoutGeocoding[articlesIndex].locationGeocoded) {
        log.debug(`Update article ${articleHref} with "${locationStr}"`)
        await collections.articles?.updateOne({_id: articleId}, {$set: {locationGeocoded: existingLocGeocoding.locationOsm}})
    }
}

const endDate = new Date()
log.info(`End: ${endDate.toLocaleString()}`);
log.info(``)
const diffInMinutes = (endDate.getTime() - startDate.getTime())/(1000*60)
log.info(`Duration (minutes): ${diffInMinutes}`)

log.info(``)
log.info(`>>> DONE <<<<`)

await client.close()
