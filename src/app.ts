import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { handleStripeWebhook } from "./controllers/payment.controller";

import adminRoutes from "./routes/admin.routes";
import appointmentRoutes from "./routes/appointment.routes";
import paymentRoutes from "./routes/payment.routes";
import serviceRoutes from "./routes/service.routes";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
				return;
			}
			callback(new Error(`Origin ${origin} is not allowed by CORS`));
		},
		credentials: true,
	}),
);

// 1. Stripe webhook MUST come before express.json() to receive the raw body.
app.post(
	"/api/payments/webhook",
	express.raw({ type: "application/json" }),
	handleStripeWebhook,
);

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
app.use(
	(err: Error, _req: Request, res: Response, _next: NextFunction) => {
		console.error("Unhandled error:", err);
		res.status(500).json({
			success: false,
			message: err.message || "Internal server error.",
		});
	},
);

export default app;
