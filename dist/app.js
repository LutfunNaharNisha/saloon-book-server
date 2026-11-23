"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const payment_controller_1 = require("./controllers/payment.controller");
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const appointment_routes_1 = __importDefault(require("./routes/appointment.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
const app = (0, express_1.default)();
app.set("trust proxy", 1);
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
}));
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
exports.default = app;
