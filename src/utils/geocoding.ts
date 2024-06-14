import {collections} from "../services/database.service.ts";
import {log} from "crawlee";
import NodeGeocoder from 'node-geocoder';
import nodeFetch from 'node-fetch';

const geocoder = NodeGeocoder({
    provider: 'openstreetmap',
    fetch: function fetch(url, options) {
        return nodeFetch(url, {
            ...options,
            headers: {
            }
        });
    }
});

export async function geocodeLocation(location: string) {
    const locationSplitted = location.split('-')

    let locationStr = (locationSplitted.length > 0) ? locationSplitted[0].trim() : location

    let foundLocation
    if (collections.geocodingLocations) {
        foundLocation = await collections.geocodingLocations.findOne({ locationString: locationStr });
        if ( foundLocation?.locationOsm) {
            return foundLocation.locationOsm
        }
    }

    let locationGeocoded
    let entries
    try {
        entries = await geocoder.geocode(locationStr);
        locationGeocoded = entries.slice(-1).at(0)
    } catch (e) {
        log.warning(`geocodeLocation first try failed for ${locationStr} with ${e}`)
    }

    let locationStrGermanPlz: string | undefined
    if (locationStr && !locationGeocoded) {
        locationStrGermanPlz = locationStr.split(' ')[0].trim()
        try {
            locationGeocoded = (await geocoder.geocode(`${locationStrGermanPlz} Germany`)).slice(-1).at(0)
        } catch (e) {
            log.warning(`geocodeLocation second try failed for ${locationStr} with ${e}`)
        }
    }

    if (collections.geocodingLocations) {
        if (!locationGeocoded && locationStrGermanPlz) {
            log.warning(`geolocation finally failed '${locationStr}', derived from '${location}'`)
            await collections.geocodingLocations.insertOne({locationString: locationStr, locationStrGermanPlz: locationStrGermanPlz})
        }

        if (locationGeocoded && !foundLocation) {
            await collections.geocodingLocations.insertOne({locationString: locationStr, locationStrGermanPlz: locationStrGermanPlz, locationOsm: locationGeocoded})
        }

        if (locationGeocoded && foundLocation && !foundLocation?.locationOsm) {
            await collections.geocodingLocations.updateMany({_id: foundLocation._id}, {$set: {locationOsm: locationGeocoded}})
        }
    }

    return locationGeocoded
}


export async function batchGeocodeLocations(locations: string[]) {

    const locationsCleaned = locations.map( loc => {
        const locationSplitted = loc.split('-')
        let locationStr = (locationSplitted.length > 0) ? locationSplitted[0].trim() : loc
        return locationStr
    })

    return await geocoder.batchGeocode(locationsCleaned)
}
