# Kleinanzeigen Crawler

This project crawls search result pages on kleinanzeigen.de for configured keywords and locations, stores the results in MongoDB, and keeps article metadata up to date over time.

## Motivation

Manual browsing is slow when you track many keywords and regions. This crawler automates repetitive checks and helps you:

- monitor new listings continuously,
- keep a searchable local dataset,
- enrich listings with geocoding for map and distance use cases,
- build downstream tools (dashboards, alerts, map views).

## Tech Stack

- Runtime: Node.js + TypeScript (ESM)
- Crawling: Crawlee + Playwright
- Parsing: node-html-parser
- Persistence: MongoDB
- Utilities: dotenv-flow, uuid, node-geocoder

## How It Works

1. Load active search profiles from MongoDB.
2. Expand them into concrete search requests (keyword + area + distance).
3. Crawl search result pages and parse listing data.
4. Insert new listings or update existing ones.
5. Track request metadata (`lastSearch`, counters) for scheduling behavior.

The main entry point is `src/main.ts`.

## Project Structure

- `src/main.ts`: crawler flow orchestration
- `src/utils/crawling.ts`: request creation, page handling, DB upsert logic
- `src/utils/parseSearchPage.ts`: HTML parsing and extraction
- `src/geolocating.ts`: geocode unresolved locations and cache results
- `src/cleaning.ts`: maintenance checks for favorite listings
- `src/services/database.service.ts`: MongoDB connection and collection setup

## Prerequisites

- Node.js 20 (see `.nvmrc`)
- MongoDB running locally or reachable from your environment

Example local MongoDB:

```bash
docker run -d -p 27017:27017 --name kleinanzeigen-mongo mongo:latest
```

## Installation

```bash
npm install
npx playwright install --with-deps
```

## Configuration

Environment files are loaded with `dotenv-flow`.

Current keys used by the app:

- `DB_NAME`
- `ARTICLES_COLLECTION_NAME`

Connection string is currently configured in `src/environments/environment.prod.ts`.

Copy and adjust values:

```bash
cp .env.example .env.local
```

## Run

```bash
npm run start:local
```

Other scripts:

- `npm run start:prod`
- `npm run start:dev:geolocating`
- `npm run build`

## Data Model (Collections)

- `articles`: crawled listing data
- `searchProfiles`: search configuration inputs
- `searchRequests`: generated request runs and timestamps
- `geocodingLocations`: cached geocoding results

## Notes

- Crawl behavior can be tuned in `src/config.ts` (headless mode, delays, filters).
- HTML selector resilience is handled with fallback selectors in the parser.
- Developer troubleshooting tips are in `docs/dev-notes.md`.

## Disclaimer

Use this crawler responsibly and in accordance with the target website terms and applicable law.
