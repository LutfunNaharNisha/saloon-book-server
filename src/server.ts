import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
	try {
		await connectDB();
	} catch (error) {
		console.error("MongoDB connection error:", error);
		// On serverless platforms the process must stay alive so that requests
		// can receive a readable 503 instead of a crashed function invocation.
		if (!process.env.VERCEL) {
			process.exit(1);
		}
	}

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
};

startServer();
