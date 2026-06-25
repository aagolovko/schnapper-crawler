import * as mongoDB from "mongodb";
import {MongoClient} from "mongodb";
import * as dotenv from "dotenv-flow";
import type {Article} from "../models/article.ts";
import type {SearchProfile} from "../models/searchProfile.ts";
import {log} from "crawlee";
import type {SearchRequest} from "../models/searchRequest.ts";
import type {GeocodingLocation} from "../models/geocodingLocation.ts";
import {environment} from "../environments/environment.prod.ts";

export const collections: {
    articles?: mongoDB.Collection<Article>,
    searchProfiles?: mongoDB.Collection<SearchProfile>,
    searchRequests?: mongoDB.Collection<SearchRequest>,
    geocodingLocations?: mongoDB.Collection<GeocodingLocation>,
} = {};

export async function connectToDatabase(): Promise<MongoClient> {
    // Pulls in the .env.local file so that it can be accessed from process.env. No path as .env.local is in root, the default location
    dotenv.config();

    const connectionString = process.env.MONGODB_URL?.trim() || environment.mongodbConnectionString;
    if (!connectionString) {
        throw new Error("Missing MongoDB connection string. Set MONGODB_URL in .env.local or environment.prod.ts.");
    }

    const dbName = process.env.DB_NAME?.trim();
    const articlesCollectionName = process.env.ARTICLES_COLLECTION_NAME?.trim();
    if (!dbName) {
        throw new Error("Missing DB_NAME in .env.local.");
    }
    if (!articlesCollectionName) {
        throw new Error("Missing ARTICLES_COLLECTION_NAME in .env.local.");
    }

    // Create a new MongoDB client with a bounded connection timeout so startup fails fast.
    const client = new mongoDB.MongoClient(connectionString, {
        serverSelectionTimeoutMS: 5000,
    });

    // Connect to the cluster
    await client.connect();

    // Connect to the database with the name specified in .env.local
    const db = client.db(dbName);

    // // Apply schema validation to the collection
    await applySchemaValidation(db, articlesCollectionName);

    // Connect to the collection with the specific name from .env.local, found in the database previously specified
    const articlesCollection = db.collection<Article>(articlesCollectionName);
    const searchProfilesCollection = db.collection<SearchProfile>('searchProfiles');
    const searchRequestsCollection = db.collection<SearchRequest>('searchRequests');
    const geocodingLocationsCollection = db.collection<GeocodingLocation>('geocodingLocations');

    // Persist the connection to the Games collection
    collections.articles = articlesCollection;
    collections.searchProfiles = searchProfilesCollection;
    collections.searchRequests = searchRequestsCollection;
    collections.geocodingLocations = geocodingLocationsCollection;

    log.info(`Successfully connected to database: ${db.databaseName} and collections`);

    return client
}

// Update our existing collection with JSON schema validation so we know our documents will always match the shape of our Game model, even if added elsewhere.
// For more information about schema validation, see this blog series: https://www.mongodb.com/blog/post/json-schema-validation--locking-down-your-model-the-smart-way
async function applySchemaValidation(db: mongoDB.Db, articlesCollectionName: string) {
    const jsonSchema = {
        $jsonSchema: {
            bsonType: "object",
            required: ["href"],
            additionalProperties: true,
            properties: {
                _id: {},
                title: {
                    bsonType: "string",
                    description: "'title' is required and is a string",
                },
                href: {
                    bsonType: "string",
                    description: "link to the article on the source platform",
                },
            },
        },
    };

    // Try applying the modification to the collection, if the collection doesn't exist, create it
    await db.command({
        collMod: articlesCollectionName,
        validator: jsonSchema
    }).catch(async (error: mongoDB.MongoServerError) => {
        if (error.codeName === 'NamespaceNotFound') {
            await db.createCollection(articlesCollectionName, {validator: jsonSchema});
        }
    });
}
