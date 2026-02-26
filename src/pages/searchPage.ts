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
    /** Click the "Accept Cookies" button if it appears. */
    async acceptCookies(): Promise<void> {
        const selector = "//button[@id='gdpr-banner-accept']";
        await this.page.waitForSelector(selector, { timeout: WAIT_FOR_SELECTOR }).then(
            (button) => button.click(),
            (failure) => {
                log.warning(`Failed to resolve 'cookies' banner, but it is not a problem: ${failure}`);
            }
        );
    }

    /** Close the welcome‑popup that appears after the first visit. */
    async closeWelcomePopup(): Promise<void> {
        const selector = "//button[@aria-label='Willkommens-Popup Schließen']";
        try {
            const element = await this.page.waitForSelector(selector, { timeout: WAIT_FOR_SELECTOR });
            await element.click();
        } catch (e) {
            log.debug(`closeWelcomePopup error: ${e}`);
        }
    }

    /** Input the search keyword into the main search field. */
    async inputSearchQuery(keyword: string): Promise<void> {
        const selector = "//input[@name='keywords']";
        const element = await this.page.waitForSelector(selector);
        await element.click({ clickCount: 3 });
        await element.type(keyword);
    }

    /** Input the location / search area. */
    async inputSearchArea(area: string): Promise<void> {
        const selector = "//input[@name='locationStr']";
        const element = await this.page.waitForSelector(selector);
        await element.click({ clickCount: 3 });
        await element.type(area);
    }

    /** Select a radius / distance around the search area. */
    async inputSearchDistance(distance: string): Promise<void> {

        try {
            const selector = "//button[@id='radius-dropdown-list-menu-button' or @id='site-search-distance-menu-button']";

            const element = await this.page.waitForSelector(selector);
            await element.click();
            const steps = {
                "5": 2,
                "10": 3,
                "20": 4,
                "30": 5,
                "50": 6,
                "100": 7,
            }[distance] ?? 3; // default to +10km
            for (let i = 0; i < steps; i++) {
                await this.page.keyboard.press("ArrowDown");
            }
            await this.page.keyboard.press("Enter");
        } catch (e) {
            log.error(`Failed to set search distance, cause [${e}]`);
        }


    }

    /** Click the "Find" (Finden) button to submit the search form. */
    async submitSearch(): Promise<void> {
        const selector = "//button[.//text()[contains(., 'Finden')]]";
        const element = await this.page.waitForSelector(selector, { timeout: WAIT_FOR_SELECTOR });
        await element.click();
        this.page.once('load', () => {});
    }

    /** Optional: input a maximum price (currently not used in the crawler). */
    async inputMaxPrice(maxPrice: number): Promise<void> {
        const selector = "//input[@id='srchrslt-brwse-price-max']";
        const element = await this.page.waitForSelector(selector);
        await element.type(`${maxPrice}`);
        const selectorBtn = "//input[@id='srchrslt-brwse-price-max']/parent::fieldset/parent::div/button";
        const elementBtn = await this.page.waitForSelector(selectorBtn);
        await elementBtn.click();
    }

    async searchPageNumber(): Promise<number> {
        if (this.page.url().includes('seite:')) {
            const urlSplitted = this.page.url().split('/');
            const searchPageNumber = Number(urlSplitted[4]?.split(':').at(1) ?? 0);
            return searchPageNumber
        }
        return 0;
    }

    async getUrl(): Promise<string> {
        return this.page.url();
    }

    /** Retrieve the URL of the immediate next pagination page. */
    async nextPages(): Promise<string[]> {
        const nextPages: string[] = [];
        try {
            const content = await this.page.content();
            const root = parse(content);

            // Current page number from the pagination span
            const currentEl = root.querySelector('.pagination-current');
            const currentPageNumber = currentEl ? Number(currentEl.text.trim()) : 0;

            // Determine the target next page number
            const targetPage = currentPageNumber + 1;
            if (targetPage > MAX_SEARCH_PAGES_FOR_KEYWORD) {
                log.info(`Ignoring search results from '${await this.getUrl()}' because next page ${targetPage} exceeds limit`);
                return [];
            }

            // Find element (link or span) whose text equals the target page number
            const candidates = root.querySelectorAll('.pagination-pages a, .pagination-pages span.pagination-not-linked');
            for (const el of candidates) {
                const pageNum = Number(el.text.trim());
                if (pageNum === targetPage) {
                    // href may be in href attribute (for <a>) or data-url (for span)
                    const href = el.getAttribute('href') ?? el.getAttribute('data-url');
                    if (href) {
                        nextPages.push(`https://www.kleinanzeigen.de${href}`);
                    }
                    break; // we only need the immediate next page
                }
            }
        } catch (e) {
            log.error(`during fetch of next pages ${e}`);
        }
        return nextPages;
    }

    async getContent() {
        return await this.page.content()
    }
}
