import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

export const mongoClient = new MongoClient(MONGO_URI);

export const connectDB = async () => {
	try {
		await mongoClient.connect();
		await mongoose.connect(MONGO_URI);
		console.log(
			"MongoDB connected successfully (Mongoose + Native Client)",
		);
	} catch (error) {
		console.error("MongoDB connection error:", error);
		process.exit(1);
	}
};
