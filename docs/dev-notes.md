# Developer Notes

This file collects practical tips for working on the crawler locally.

## Quick Start

```bash
nvm use 20
npm install
npx playwright install --with-deps
npm run start:local
```

## Useful Scripts

- `npm run start:local`: run crawler locally
- `npm run start:prod`: run production profile
- `npm run start:dev:geolocating`: geocode unresolved locations
- `npm run build`: compile TypeScript

## MongoDB Notes

Run local MongoDB quickly:

```bash
docker run -d -p 27017:27017 --name kleinanzeigen-mongo mongo:latest
```

Handy Mongo shell queries:

```javascript
// Fix empty geocode payloads
db.articles.updateMany({ locationGeocoded: {} }, { $set: { locationGeocoded: null } })

// Resolve conflicting flags
db.articles.updateMany(
  { isIgnored: true, isFavorite: true },
  { $set: { isIgnored: true, isFavorite: null } }
)

// Remove all listings for a keyword
db.articles.deleteMany({ searchKeywords: { $in: ["Mighty Plus"] } })
```

## Debugging Tips

- Cache of crawled search pages is written to `search-pages/` by `src/utils/crawling.ts`.
- Main parser entry: `src/utils/parseSearchPage.ts`.
- If date extraction breaks, inspect selectors around:
  - `.aditem-main--top--right i`
  - `svg[data-title="calendarOutline"] + span`
- Slow down crawling for debugging via `PAUSE_MS` in `src/config.ts`.
- Restrict crawl scope via `DEBUG_SEARCH_KEYWORDS` and `ONLY_ALLOWED_KEYWORDS` in `src/config.ts`.

## Common Pitfalls

- `STOP_CRAWLING` exists in config but is currently unused.
- `MIN_TIME_BETWEEN_SEARCHES_MINUTES` can skip expected searches if set too high.
- DB connection string currently comes from `src/environments/environment.prod.ts`, not from `.env`.
- Do not commit real `.env` values; keep only `.env.example` tracked.

## Code Navigation

- Request generation and filtering: `findSearchRequests()` in `src/utils/crawling.ts`.
- Article upsert logic: `handleArticle()` in `src/utils/crawling.ts`.
- DB wiring and collection registration: `src/services/database.service.ts`.
- End-of-run stats: `src/printStatistics.ts`.

## Safe Refactor Ideas

- Move MongoDB connection string to environment variables for consistency.
- Add smoke tests for parser behavior against sample HTML pages.
- Split parser selectors into small helper functions to make failures easier to diagnose.
- Add a lint setup (ESLint + TypeScript rules) for quick quality checks.
