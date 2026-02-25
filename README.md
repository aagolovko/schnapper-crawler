# Intro
This code crawl the kleinanzeigen web page for specific keywords like "regentonne" and  persists the results.

# Technical implementation
The selenium framework is used to crawl to make the behaviour of the crawler more human-like and to avoid blocking by the web page.
The data fetched is persisted in a mongodb as JSON. Another component provide access to the 
database over GraphQL which finally is visualized in a web application.

# Algorithm
The algorithm for crawling is as follows:
- fetch the landing page of the kleinanzeigen.de
- enter keyword/location/distance for search, submit search form
- fetch items, fetch next results pages 
- do the same for futher results pages
- for each itme fetch details page, extract details, persist in database


# Tools

clean up npm caches:
```
npm config set fund false --location=global

rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npx playwright install --with-deps
```

nvm updates to fix "EBADENGINE":
```
nvm install 20
nvm use 20
echo "20" > .nvmrc
```



# actually we should avoid this, but sometimes:
use kleinanzeigen

# set emmpty object to "null", run "02. geolocatin" 
db.articles.updateMany({locationGeocoded: {}}, {$set: {locationGeocoded: null}} )

# if both ignored/favorite is set, remove favorite flag and reconsider items
db.articles.updateMany({isIgnored: true, isFavorite: true}, {$set: {isIgnored: true, isFavorite: null}} )

{ lastSearch: { $exists: true } }


# for debugging with break points
{
    $or: [
        { lastChecked: { $exists: true } },
        { href: "/s-anzeige/ondis24-regentonne-mit-deckel-500-liter-wasserhahn-mit-filter/2786692625-87-5981" }
    ]
}


{
    $or: [
        { lastChecked: { $gt: ISODate("2024-06-14T14:09:14.042+00:00") } }
    ]
}

# remove articles found for specific keyword
db.articles.deleteMany({searchKeywords: {$in: ['Mighty Plus']}})

# add "last checked" field to avoid deletion of item not too often
# add UI to remove articles for keyword
# fix: "84072 Bayern - Au" changed to "84072 Au" and geocoded to schweiz
live
* proble: failed detect isDeleted "/s-anzeige/ivar-regal-zu-verschenken/2536126591-192-6350" 

* do not save items, if too away. detect "Alternative Anzeigen in der Umgebung" and skip items after it
* repo for the code
* create SJON with search requests, save search request in dB 
* save items found in db
* generate KML with all results form dB
* vizualize results on map, click to mark items as "not-interesing" or "interesting"
* special vizual code for "zum verschenken" or low price.

* statistics for crawler: last time search for keyword, new items found for search etc.

* generate mongodb UI: https://retool.com/blog/build-a-mongodb-gui-in-minutes/

* convert address to location with google
* fetch links to the next search pages
* use json as input for the search
* save crawling results to database
* convert Article to geoJson, convert geoJson to KML format
* re-think the architecture for mining, probably use crawlee cloud


docker run -d -p 27017:27017 --name kleinanzeigen-mongo mongo:latest

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

