import {ObjectId} from "mongodb";

export interface SearchRequest {
    _id?: ObjectId;
    keyword: string;
    searchArea: string;
    searchDistance: string;
    maxPrice?: number;
    lastSearch?: timestamp;
    articlesFound?: number;
}
