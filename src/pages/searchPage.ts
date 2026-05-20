// src/pages/landingPage.ts

import { Page } from "playwright";
import { log } from "crawlee";
import { WAIT_FOR_SELECTOR, PAUSE_MS, MAX_SEARCH_PAGES_FOR_KEYWORD } from "../config.ts";
import { parse } from "node-html-parser";

/**
 * Page Object Model for the initial landing page of kleinanzeigen.de.
 * All interactions that were previously implemented as stand‑alone utility
 * functions are now encapsulated as methods of this class.
 */
export class SearchPage {
    constructor(private readonly page: Page) {}

    async getUrl(): Promise<string> {
        return this.page.url();
    }

    async getContent() {
        return await this.page.content()
    }
}
