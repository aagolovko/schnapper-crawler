# TODO: 

* repo for the code
* create SJON with search requests, save search request in dB 
* save items found in db
* generate KML with all results form dB
* vizualize results on map, click to mark items as "not-interesing" or "interesting"

* convert address to location with google
* fetch links to the next search pages
* use json as input for the search
* save crawling results to database
* convert Article to geoJson, convert geoJson to KML format
* re-think the architecture for mining, probably use crawlee cloud

# Getting started with Crawlee

This example uses `PlaywrightCrawler` to recursively crawl https://crawlee.dev using the browser automation library [Playwright](https://playwright.dev).

You can find more examples and documentation at the following links:

- [Step-by-step tutorial](https://crawlee.dev/docs/introduction) for Crawlee
- `PlaywrightCrawler` [API documentation](https://crawlee.dev/api/playwright-crawler/class/PlaywrightCrawler)
- Other [examples](https://crawlee.dev/docs/examples/playwright-crawler)


XPath selector in chrome:
```
//button[@id="gdpr-banner-accept"]
```
