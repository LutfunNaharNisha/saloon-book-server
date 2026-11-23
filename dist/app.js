import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB } from "./config/db.js";
import { handleStripeWebhook } from "./controllers/payment.controller.js";
import adminRoutes from "./routes/admin.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import serviceRoutes from "./routes/service.routes.js";
dotenv.config();
const app = express();
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
app.use(cors({
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
        await connectDB();
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
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
// 2. Standard body parsers. Better Auth is hosted by the frontend; this API
// only accepts JWTs issued there via the Authorization: Bearer header.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
// 3. Application REST API routes.
app.use("/api/services", serviceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
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
// The project is native ES modules. Vercel's Node.js builder imports the
// default export from this single Express entry point for every route.
export default app;
