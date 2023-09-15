import {ObjectId} from "mongodb";

export interface GeocodingLocation {
    _id?: ObjectId;
    locationString: string;
    locationStrGermanPlz?: string;
    locationOsm?: any;
}
