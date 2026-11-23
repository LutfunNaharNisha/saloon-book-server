"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDB = exports.connectDB = exports.getMongoClient = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let client = null;
let connection = null;
const getUri = () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error("MONGO_URI is not set. Add it to the environment variables of the server.");
    }
    return uri;
};
/**
 * Lazily create the native MongoDB client.
 * Creating it at import time would crash the whole serverless function when
 * MONGO_URI is missing, instead of returning a readable error for that request.
 */
const getMongoClient = () => {
    if (!client) {
        client = new mongodb_1.MongoClient(getUri());
    }
    return client;
};
exports.getMongoClient = getMongoClient;
/**
 * Connect Mongoose and the native driver once per process/cold start and reuse
 * the connection for later requests. Required on serverless platforms such as
 * Vercel, where every route shares a single long-lived function instance.
 */
const connectDB = async () => {
    if (mongoose_1.default.connection.readyState === 1)
        return;
    if (!connection) {
        connection = (async () => {
            const uri = getUri();
            await (0, exports.getMongoClient)().connect();
            await mongoose_1.default.connect(uri);
            console.log("MongoDB connected successfully (Mongoose + Native Client)");
        })();
        // Allow a later request to retry after a failed attempt.
        connection = connection.catch((error) => {
            connection = null;
            throw error;
        });
    }
    await connection;
};
exports.connectDB = connectDB;
const closeDB = async () => {
    await mongoose_1.default.disconnect().catch(() => undefined);
    if (client) {
        await client.close().catch(() => undefined);
    }
};
exports.closeDB = closeDB;
