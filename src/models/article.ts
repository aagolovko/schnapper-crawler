import {ObjectId} from "mongodb";

export interface Article {
    _id?: ObjectId;
    href: string;
    hrefImage?: string;
    title?: string;
    id?: ObjectId;
    price?: string; // Examples: VB, 20 € VB, zum verschenken
    priceEur?: number;
    location: string;
    isShipping?: any;
    locationGeocoded?: any; // TODO: object has own schema, make sense to use it?
    notes?: string;
    isFavorite?: boolean; // TODO: how to fix? why is it red? default value possible?
    isIgnored?: boolean;
    createdOn: Date;
    searchKeywords: string[];

    unavailableOn?: Date; // the timestamp when the item was detetected as unavailable
}
