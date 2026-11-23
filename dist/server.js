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
const startServer = async () => {
    try {
        await (0, db_1.connectDB)();
    }
    catch (error) {
        console.error("MongoDB connection error:", error);
        // On serverless platforms the process must stay alive so that requests
        // can receive a readable 503 instead of a crashed function invocation.
        if (!process.env.VERCEL) {
            process.exit(1);
        }
    }
    app_1.default.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
};
startServer();
