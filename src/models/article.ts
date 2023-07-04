import { ObjectId } from "mongodb";

export interface Article {
    href: string;
    title?: string;
    id?: ObjectId;
    price?: string;
    location: string;
    isShipping?: any;
    locationGeocoded?: any;
}
