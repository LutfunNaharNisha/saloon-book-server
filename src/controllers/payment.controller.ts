import { Request, Response } from "express";
import mongoose from "mongoose";
import { getStripe } from "../config/stripe";
import { AuthRequest } from "../middlewares/auth.middleware";
import { Appointment } from "../models/Appointment";
import { Transaction } from "../models/Transaction";

const markPaid = async (session: any) => {
	const appointmentId = session.metadata?.appointmentId;
	const customerId = session.metadata?.customerId;
	if (!appointmentId || !customerId) return;

	await Appointment.findByIdAndUpdate(appointmentId, {
		paymentStatus: "paid",
	});

	await Transaction.findOneAndUpdate(
		{ stripeSessionId: session.id },
		{
			$set: {
				appointmentId: new mongoose.Types.ObjectId(appointmentId),
				customerId: new mongoose.Types.ObjectId(customerId),
				amount: (session.amount_total || 0) / 100,
				currency: session.currency || "usd",
				stripeSessionId: session.id,
				status: "paid",
			},
		},
		{ upsert: true, new: true },
	);
};

// Customer: Create Stripe Checkout Session for a Confirmed Appointment
export const createCheckoutSession = async (
	req: AuthRequest,
	res: Response,
) => {
	try {
		const { appointmentId } = req.body as { appointmentId?: string };
		if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid appointment ID." });
		}

		const customerId = new mongoose.Types.ObjectId(req.user!.id);

		const appointment = await Appointment.findOne({
			_id: appointmentId,
			customerId,
		}).populate("serviceId");

		if (!appointment) {
			return res
				.status(404)
				.json({ success: false, message: "Appointment not found." });
		}

		if (appointment.status !== "confirmed") {
			return res.status(400).json({
				success: false,
				message: "Only confirmed appointments can be paid for.",
			});
		}

		if (appointment.paymentStatus === "paid") {
			return res.status(400).json({
				success: false,
				message: "This appointment has already been paid.",
			});
		}

		const service: any = appointment.serviceId;
		const clientUrl = (
			process.env.CLIENT_URL ||
			(process.env.VERCEL
				? "https://saloon-book-client.vercel.app"
				: "http://localhost:3000")
		)
			.split(",")[0]
			.trim()
			.replace(/\/$/, "");

		const session = await getStripe().checkout.sessions.create({
			payment_method_types: ["card"],
			mode: "payment",
			customer_email: req.user!.email,
			client_reference_id: appointment._id.toString(),
			line_items: [
				{
					price_data: {
						currency: "usd",
						product_data: {
							name: service?.serviceName || "Salon appointment",
							description: `Appointment on ${appointment.appointmentDate
								.toISOString()
								.slice(0, 10)} at ${appointment.timeSlot}`,
						},
						unit_amount: Math.round(
							appointment.servicePrice * 100,
						),
					},
					quantity: 1,
				},
			],
			metadata: {
				appointmentId: appointment._id.toString(),
				customerId: req.user!.id,
			},
			success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${clientUrl}/payment/cancel?appointment_id=${appointment._id.toString()}`,
		});

		res.status(200).json({
			success: true,
			url: session.url,
			sessionId: session.id,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Customer: Verify a Checkout Session after redirect (webhook fallback / UX)
export const verifyCheckoutSession = async (req: AuthRequest, res: Response) => {
	try {
		const sessionId = req.query.session_id;
		if (!sessionId || typeof sessionId !== "string") {
			return res.status(400).json({
				success: false,
				message: "Missing Stripe checkout session ID.",
			});
		}

		const session = await getStripe().checkout.sessions.retrieve(sessionId);

		if (session.metadata?.customerId !== req.user!.id) {
			return res.status(403).json({
				success: false,
				message: "This payment does not belong to your account.",
			});
		}

		if (session.payment_status === "paid") {
			await markPaid(session);
			return res.status(200).json({
				success: true,
				paid: true,
				appointmentId: session.metadata?.appointmentId,
				amount: (session.amount_total || 0) / 100,
				currency: session.currency || "usd",
			});
		}

		return res.status(200).json({
			success: true,
			paid: false,
			message: "Payment has not been completed yet.",
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Stripe Webhook Handler (raw body required)
export const handleStripeWebhook = async (req: Request, res: Response) => {
	const sig = req.headers["stripe-signature"] as string;
	let event;

	// Express is the request handler on Vercel, so `express.raw` normally gives
	// us the Buffer. Keep a fallback for runtimes that pre-parse the body.
	const rawBody = Buffer.isBuffer(req.body)
		? req.body
		: Buffer.from(
				typeof req.body === "string"
					? req.body
					: JSON.stringify(req.body ?? {}),
			);

	try {
		event = getStripe().webhooks.constructEvent(
			rawBody,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET as string,
		);
	} catch (err: any) {
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	try {
		if (
			event.type === "checkout.session.completed" ||
			event.type === "checkout.session.async_payment_succeeded"
		) {
			const session = event.data.object as any;
			if (session.payment_status === "paid") {
				await markPaid(session);
			}
		} else if (event.type === "checkout.session.async_payment_failed") {
			const session = event.data.object as any;
			const { appointmentId, customerId } = session.metadata || {};
			if (appointmentId && customerId) {
				await Transaction.findOneAndUpdate(
					{ stripeSessionId: session.id },
					{
						$set: {
							appointmentId: new mongoose.Types.ObjectId(
								appointmentId,
							),
							customerId: new mongoose.Types.ObjectId(
								customerId,
							),
							amount: (session.amount_total || 0) / 100,
							currency: session.currency || "usd",
							stripeSessionId: session.id,
							status: "failed",
						},
					},
					{ upsert: true, new: true },
				);
			}
		}

		res.status(200).json({ received: true });
	} catch (error: any) {
		res.status(500).send(`Webhook handler error: ${error.message}`);
	}
};

// Customer: View Own Payment History
export const getMyTransactions = async (req: AuthRequest, res: Response) => {
	try {
		const transactions = await Transaction.find({
			customerId: new mongoose.Types.ObjectId(req.user!.id),
		})
			.populate({
				path: "appointmentId",
				populate: {
					path: "serviceId",
					select: "serviceName category image",
				},
			})
			.sort({ createdAt: -1 });

		res.status(200).json({ success: true, data: transactions });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};
