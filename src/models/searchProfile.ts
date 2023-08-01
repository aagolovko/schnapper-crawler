import {ObjectId} from "mongodb";

export interface SearchProfile {
    // TODO: remove, we have _id
    id?: ObjectId;

    /**
     * like:
     *
     * "Профілі з металу"
     */
    title: string;

    /**
     * like
     *
     * [
     *     "systemprofil",
     *     "eckprofil",
     *     "aluprofil",
     *     "alu-eckprofil"
     *   ]
     **/
    keywords: string[];

    // not always applicable (when given per meter, per kilo etc)
    maxPrice?: number;

    /**
     * like:
     *
     * "Ціну перераховуєм в евро/метр. Треба 45х45 алю профілі, також
     * металічні оцинковані кутики."
     */
    notes?: string;

    /**
     * TODO: what should it be?
     * * cron expression?
     * * frequence in tries per day?
     */
    searchSchedule?: string;

    /**
     * if specified, use only this locations for search. Otherwise
     * use all other active locations as found in Mongo.
     */
    locations?: SearchLocation[];

    maxPrice?: number;
}
