import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

// Start listening before connecting so a slow/unreachable database can never
// prevent the serverless function (or local server) from accepting requests.
// The `/api` middleware connects lazily and answers 503 if the DB is down.
const server = app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

connectDB().catch((error) => {
	console.error("MongoDB connection error:", error);
});

const shutdown = () => {
	server.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
