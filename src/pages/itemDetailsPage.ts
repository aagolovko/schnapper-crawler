// src/pages/itemDetailsPage.ts

import { Page } from "playwright";
import { parse } from "node-html-parser";

/**
 * Page Object Model for a single article detail page.
 * Provides helpers to extract useful information and to determine the
 * availability status of the ad.
 */
export class ItemDetailsPage {
    constructor(private readonly page: Page) {}

    /** Load the page (if not already navigated) and return the raw HTML. */
    private async getContent(): Promise<string> {
        return await this.page.content();
    }

    /** Parse the current page content with node-html-parser. */
    private async getRoot() {
        const content = await this.getContent();
        return parse(content);
    }

    /** Check whether the article is marked as deleted/expired. */
    async isDeleted(): Promise<boolean> {
        const root = await this.getRoot();
        // First check the veil element text
        let expiredText = root
            .querySelectorAll('.pvap-reserved-image-veil:not(.is-hidden)')
            .map((el) => el.text)
            .shift();
        expiredText ??= "";
        if (expiredText === "Gel\u00f6scht") return true;

        // Additional checks used in the original crawler
        const warningMsg = root
            .querySelectorAll('.outcomemessage-warning')
            .map((x) => x.innerText.trim())
            .shift();
        const titleMsg = root
            .querySelectorAll('.pvap-reserved-title:not(.is-hidden)')
            .map((x) => x.innerText.trim())
            .shift() ?? "";

        return (
            warningMsg === "Die gew\u00fcnschte Anzeige ist nicht mehr verf\u00fcgbar." ||
            titleMsg.includes("Gel\u00f6scht")
        );
    }

    /** Retrieve the ad title if present. */
    async getTitle(): Promise<string | null> {
        const root = await this.getRoot();
        const titleEl = root.querySelector('.pvap-reserved-title') || root.querySelector('.viewad-title');
        return titleEl?.innerText?.trim() ?? null;
    }

    /** Retrieve the price element (if the page contains a price). */
    async getPrice(): Promise<string | null> {
        const root = await this.getRoot();
        const priceEl =
            root.querySelector('#viewad-price') ||
            root.querySelector('.viewad-price') ||
            root.querySelector('.boxedarticle--price') ||
            root.querySelector('.aditem-main--middle--price-shipping--price') ||
            root.querySelector('[itemprop="price"]') ||
            root.querySelector('meta[property="product:price:amount"]') ||
            root.querySelector('meta[itemprop="price"]');

        if (!priceEl) {
            return null;
        }

        const metaContent = priceEl.getAttribute?.('content');
        return (metaContent ?? priceEl.innerText ?? priceEl.textContent ?? null)?.trim() ?? null;
    }
}
