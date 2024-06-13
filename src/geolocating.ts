import {collections, connectToDatabase} from "./services/database.service.ts";
import {Article} from "./models/article";
import {log} from "crawlee";
import {batchGeocodeLocations} from "./utils/geocoding.ts";

const client = await connectToDatabase()

await collections.geocodingLocations!!.updateMany({locationGeocoded: {}}, {$set: {locationGeocoded: null}} )

const articlesWithoutGeolocation: Article[] = await (collections.articles!!.find(
    {locationGeocoded: null}
)).toArray();

const startDate = new Date()

const unknownGeolocationsPrep: string[] = articlesWithoutGeolocation
    .map(a => a.location)
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .filter((value) => value !== undefined)

const unknownGeolocations: string[] = []
for (const loc of unknownGeolocationsPrep) {
    const x = await collections.geocodingLocations!!.findOne({
        locationString: loc
    })

    if (x?.locationOsm == null) {
        unknownGeolocations.push(loc)
    }

}

log.info(``)
log.info(``)
log.info(`Going to geocode locations for ${articlesWithoutGeolocation.length} articles`)
log.info(`Going to geocode for ${unknownGeolocations.length} unique locations`)
log.info(`Start: ${startDate.toLocaleString()}`);
log.info(``)
log.info(``)

// for (const loc of unknownGeolocations) {
//     await collections.geocodingLocations.deleteMany({locationString: loc});
// }

if (unknownGeolocations && unknownGeolocations.length > 0) {
    const geocoded = await batchGeocodeLocations(unknownGeolocations)
    for (const locIndex in unknownGeolocations) {
        const existingLocGeocoding = await collections.geocodingLocations!!.findOne({locationString: unknownGeolocations[locIndex]});
        const resolvedLocGeocoding = geocoded[locIndex].error ? null : geocoded[locIndex].value.shift()
        if (!existingLocGeocoding && resolvedLocGeocoding) {
            log.info(`New location ${unknownGeolocations[locIndex]}`)
            await collections.geocodingLocations!!.insertOne({
                locationString: unknownGeolocations[locIndex],
                locationOsm: resolvedLocGeocoding
            })
        }

        if (!resolvedLocGeocoding) {
            log.warning(`Failed geocoding for location "${unknownGeolocations[locIndex]}" with ${geocoded[locIndex].error}`)
        }
    }
}

for (const index in articlesWithoutGeolocation) {
    let locationStr = articlesWithoutGeolocation[index].location;
    let articleHref = articlesWithoutGeolocation[index].href;
    let articleId = articlesWithoutGeolocation[index]._id;

    const locationSplitted = locationStr.split('-')
    locationStr = (locationSplitted.length > 0) ? locationSplitted[0].trim() : locationStr

    const existingLocGeocoding = await collections.geocodingLocations!!.findOne({locationString: locationStr});
    if (existingLocGeocoding && !articlesWithoutGeolocation[index].locationGeocoded) {
        log.debug(`Update article ${articleHref} with "${locationStr}"`)
        await collections.articles?.updateOne({_id: articleId}, {$set: {locationGeocoded: existingLocGeocoding.locationOsm}})
    }
}

const endDate = new Date()
log.info(``)
log.info(`End: ${endDate.toLocaleString()}`);
const diffInMinutes = (endDate.getTime() - startDate.getTime())/(1000*60)
log.info(`Duration (minutes): ${diffInMinutes}`)

log.info(``)
log.info(`>>> DONE <<<<`)
log.info(``)

await client.close()
