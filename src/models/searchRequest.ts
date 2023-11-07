import {ObjectId} from "mongodb";

export interface SearchRequest {
    _id?: ObjectId;
    keyword: string;
    searchArea: string;
    searchDistance: string;
    maxPrice?: number;
    lastSearch?: Date;
    articlesFound?: number;
}
