"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 5000;
// Start listening before connecting so a slow/unreachable database can never
// prevent the serverless function (or local server) from accepting requests.
// The `/api` middleware connects lazily and answers 503 if the DB is down.
const server = app_1.default.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
(0, db_1.connectDB)().catch((error) => {
    console.error("MongoDB connection error:", error);
});
const shutdown = () => {
    server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
