"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const db_1 = require("./config/db");
const payment_controller_1 = require("./controllers/payment.controller");
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const appointment_routes_1 = __importDefault(require("./routes/appointment.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.set("trust proxy", 1);
/**
 * Origins allowed to call this API. The deployed client (and local dev) are
 * always allowed; extra origins can be added through CLIENT_URL / APP_URL as a
 * comma-separated list, which is useful for preview deployments.
 */
const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://saloon-book-client.vercel.app",
];
const allowedOrigins = [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...(process.env.CLIENT_URL || "").split(","),
    ...(process.env.APP_URL || "").split(","),
]
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
/** Allow Vercel preview deployments of the client project. */
const allowedOriginPatterns = [
    /^https:\/\/saloon-book-client(?:-[a-z0-9-]+)?\.vercel\.app$/i,
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const normalized = origin?.replace(/\/$/, "");
        if (!normalized ||
            allowedOrigins.includes(normalized) ||
            allowedOriginPatterns.some((pattern) => pattern.test(normalized))) {
            callback(null, true);
            return;
        }
        // Do not throw: a thrown CORS error turns into a 500 without CORS
        // headers, which browsers report as a misleading CORS failure.
        console.warn(`Blocked CORS origin: ${normalized}`);
        callback(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 204,
}));
/**
 * Serverless platforms do not run `server.ts` for API requests, so make sure a
 * database connection exists before any /api route executes. The connection is
 * cached across requests, making this a no-op after the first successful call.
 */
const ensureDatabase = async (_req, res, next) => {
    try {
        await (0, db_1.connectDB)();
        next();
    }
    catch (error) {
        console.error("Database connection failed:", error);
        res.status(503).json({
            success: false,
            message: "Database is not reachable. Check the MONGO_URI environment variable and the MongoDB network access list.",
        });
    }
};
app.use("/api", ensureDatabase);
// 1. Stripe webhook MUST come before express.json() to receive the raw body.
app.post("/api/payments/webhook", express_1.default.raw({ type: "application/json" }), payment_controller_1.handleStripeWebhook);
// 2. Standard body parsers. Better Auth is hosted by the frontend; this API
// only accepts JWTs issued there via the Authorization: Bearer header.
app.use(express_1.default.json({ limit: "2mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// 3. Application REST API routes.
app.use("/api/services", service_routes_1.default);
app.use("/api/appointments", appointment_routes_1.default);
app.use("/api/payments", payment_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.get("/", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "SalonBook API is running.",
    });
});
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date() });
});
// 4. 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});
// 5. Global error handler
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        success: false,
        message: err.message || "Internal server error.",
    });
});
module.exports = app;
