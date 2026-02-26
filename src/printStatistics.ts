import {collections} from "./services/database.service.ts";
import {log} from "crawlee";

export async function printStatistics(startDate: Date) {
    let find = collections.articles!!.find();
    const totalArticles = (await find.toArray()).length;
    log.info(``)
    log.info(`Total of ${totalArticles} in db now`)
    log.info(``)


    const endDate = new Date()
    log.info(``)
    log.info(`End: ${endDate.toLocaleString()}`);
    const diffInMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
    log.info(`Duration (minutes): ${diffInMinutes}`)

    log.info(`>>> DONE <<<<`)
    log.info(``)
}