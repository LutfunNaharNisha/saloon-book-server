"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyTransactions = exports.handleStripeWebhook = exports.verifyCheckoutSession = exports.createCheckoutSession = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const stripe_1 = require("../config/stripe");
const Appointment_1 = require("../models/Appointment");
const Transaction_1 = require("../models/Transaction");
const markPaid = async (session) => {
    const appointmentId = session.metadata?.appointmentId;
    const customerId = session.metadata?.customerId;
    if (!appointmentId || !customerId)
        return;
    await Appointment_1.Appointment.findByIdAndUpdate(appointmentId, {
        paymentStatus: "paid",
    });
    await Transaction_1.Transaction.findOneAndUpdate({ stripeSessionId: session.id }, {
        $set: {
            appointmentId: new mongoose_1.default.Types.ObjectId(appointmentId),
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            amount: (session.amount_total || 0) / 100,
            currency: session.currency || "usd",
            stripeSessionId: session.id,
            status: "paid",
        },
    }, { upsert: true, new: true });
};
// Customer: Create Stripe Checkout Session for a Confirmed Appointment
const createCheckoutSession = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        if (!appointmentId || !mongoose_1.default.Types.ObjectId.isValid(appointmentId)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid appointment ID." });
        }
        const customerId = new mongoose_1.default.Types.ObjectId(req.user.id);
        const appointment = await Appointment_1.Appointment.findOne({
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
        const service = appointment.serviceId;
        const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const session = await stripe_1.stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: req.user.email,
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
                        unit_amount: Math.round(appointment.servicePrice * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                appointmentId: appointment._id.toString(),
                customerId: req.user.id,
            },
            success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/payment/cancel?appointment_id=${appointment._id.toString()}`,
        });
        res.status(200).json({
            success: true,
            url: session.url,
            sessionId: session.id,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCheckoutSession = createCheckoutSession;
// Customer: Verify a Checkout Session after redirect (webhook fallback / UX)
const verifyCheckoutSession = async (req, res) => {
    try {
        const sessionId = req.query.session_id;
        if (!sessionId || typeof sessionId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Missing Stripe checkout session ID.",
            });
        }
        const session = await stripe_1.stripe.checkout.sessions.retrieve(sessionId);
        if (session.metadata?.customerId !== req.user.id) {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.verifyCheckoutSession = verifyCheckoutSession;
// Stripe Webhook Handler (raw body required)
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe_1.stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        if (event.type === "checkout.session.completed" ||
            event.type === "checkout.session.async_payment_succeeded") {
            const session = event.data.object;
            if (session.payment_status === "paid") {
                await markPaid(session);
            }
        }
        else if (event.type === "checkout.session.async_payment_failed") {
            const session = event.data.object;
            const { appointmentId, customerId } = session.metadata || {};
            if (appointmentId && customerId) {
                await Transaction_1.Transaction.findOneAndUpdate({ stripeSessionId: session.id }, {
                    $set: {
                        appointmentId: new mongoose_1.default.Types.ObjectId(appointmentId),
                        customerId: new mongoose_1.default.Types.ObjectId(customerId),
                        amount: (session.amount_total || 0) / 100,
                        currency: session.currency || "usd",
                        stripeSessionId: session.id,
                        status: "failed",
                    },
                }, { upsert: true, new: true });
            }
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        res.status(500).send(`Webhook handler error: ${error.message}`);
    }
};
exports.handleStripeWebhook = handleStripeWebhook;
// Customer: View Own Payment History
const getMyTransactions = async (req, res) => {
    try {
        const transactions = await Transaction_1.Transaction.find({
            customerId: new mongoose_1.default.Types.ObjectId(req.user.id),
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyTransactions = getMyTransactions;
