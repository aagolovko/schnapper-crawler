import { ObjectId } from "mongodb";

export interface SearchLocation {
    id?: ObjectId;

    /**
     * like: "81375 Hadern"
     */
    searchArea: string;

    /**
     * like: "20" which means 20km
     */
    searchDistance: string;

    /**
     * specify if the location must be taken into account when searching
     * for articles
     */
    isActive: boolean;
}
