import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let client: MongoClient | null = null;
let connection: Promise<void> | null = null;

const getUri = (): string => {
	const uri = process.env.MONGO_URI;
	if (!uri) {
		throw new Error(
			"MONGO_URI is not set. Add it to the environment variables of the server.",
		);
	}
	return uri;
};

/**
 * Lazily create the native MongoDB client.
 * Creating it at import time would crash the whole serverless function when
 * MONGO_URI is missing, instead of returning a readable error for that request.
 */
export const getMongoClient = (): MongoClient => {
	if (!client) {
		client = new MongoClient(getUri());
	}
	return client;
};

/**
 * Connect Mongoose and the native driver once per process/cold start and reuse
 * the connection for later requests. Required on serverless platforms such as
 * Vercel, where every route shares a single long-lived function instance.
 */
export const connectDB = async (): Promise<void> => {
	if (mongoose.connection.readyState === 1) return;

	if (!connection) {
		connection = (async () => {
			const uri = getUri();
			await getMongoClient().connect();
			await mongoose.connect(uri);
			console.log(
				"MongoDB connected successfully (Mongoose + Native Client)",
			);
		})();

		// Allow a later request to retry after a failed attempt.
		connection = connection.catch((error) => {
			connection = null;
			throw error;
		});
	}

	await connection;
};

export const closeDB = async (): Promise<void> => {
	await mongoose.disconnect().catch(() => undefined);
	if (client) {
		await client.close().catch(() => undefined);
	}
};
