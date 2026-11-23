import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middlewares/auth.middleware.js";
import { Appointment } from "../models/Appointment.js";
import { Service } from "../models/Service.js";
import { Transaction } from "../models/Transaction.js";
import { getObjectIdParam } from "../utils/params.js";

export const TIME_SLOTS = [
	"09:00 AM",
	"10:00 AM",
	"11:00 AM",
	"12:00 PM",
	"01:00 PM",
	"02:00 PM",
	"03:00 PM",
	"04:00 PM",
	"05:00 PM",
	"06:00 PM",
	"07:00 PM",
];

const parseAppointmentDay = (value: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const day = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(day.getTime())) return null;
	return day;
};

// Customer: Submit Appointment Request
export const createAppointment = async (req: AuthRequest, res: Response) => {
	try {
		const { serviceId, appointmentDate, timeSlot, message } = req.body as {
			serviceId?: string;
			appointmentDate?: string;
			timeSlot?: string;
			message?: string;
		};

		if (!serviceId || !appointmentDate || !timeSlot) {
			return res.status(400).json({
				success: false,
				message:
					"Service, appointment date and time slot are required.",
			});
		}

		const serviceObjectId = getObjectIdParam(serviceId);
		if (!serviceObjectId) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid service ID." });
		}

		const day = parseAppointmentDay(appointmentDate);
		if (!day) {
			return res.status(400).json({
				success: false,
				message: "Invalid appointment date. Use YYYY-MM-DD.",
			});
		}

		const today = new Date();
		const todayUtc = new Date(
			Date.UTC(
				today.getUTCFullYear(),
				today.getUTCMonth(),
				today.getUTCDate(),
			),
		);
		if (day < todayUtc) {
			return res.status(400).json({
				success: false,
				message: "Appointment date cannot be in the past.",
			});
		}

		if (!TIME_SLOTS.includes(timeSlot)) {
			return res.status(400).json({
				success: false,
				message: "Please choose a valid time slot.",
			});
		}

		const service = await Service.findById(serviceObjectId);
		if (!service || service.status !== "active") {
			return res.status(404).json({
				success: false,
				message: "Selected service is unavailable or inactive.",
			});
		}

		const nextDay = new Date(day);
		nextDay.setUTCDate(nextDay.getUTCDate() + 1);

		// One active booking per date + time slot for the salon.
		const conflict = await Appointment.findOne({
			appointmentDate: { $gte: day, $lt: nextDay },
			timeSlot,
			status: { $in: ["pending", "confirmed"] },
		});

		if (conflict) {
			return res.status(409).json({
				success: false,
				message:
					"That time slot is already booked. Please choose another date or time.",
			});
		}

		const appointment = await Appointment.create({
			serviceId: service._id,
			customerId: new mongoose.Types.ObjectId(req.user!.id),
			appointmentDate: day,
			timeSlot,
			message: message?.trim() || "",
			servicePrice: service.price,
			paymentStatus: "unpaid",
			status: "pending",
		});

		res.status(201).json({ success: true, data: appointment });
	} catch (error: any) {
		res.status(400).json({ success: false, message: error.message });
	}
};

// Customer: View Own Appointments & Status
export const getMyAppointments = async (req: AuthRequest, res: Response) => {
	try {
		const appointments = await Appointment.find({
			customerId: new mongoose.Types.ObjectId(req.user!.id),
		})
			.populate("serviceId", "serviceName category duration image status")
			.sort({ createdAt: -1 });

		res.status(200).json({ success: true, data: appointments });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Customer: Cancel Pending Appointment Request
export const cancelPendingAppointment = async (
	req: AuthRequest,
	res: Response,
) => {
	try {
		const appointmentId = getObjectIdParam(req.params.id);
		if (!appointmentId) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid appointment ID." });
		}

		const appointment = await Appointment.findOne({
			_id: appointmentId,
			customerId: new mongoose.Types.ObjectId(req.user!.id),
		});

		if (!appointment) {
			return res
				.status(404)
				.json({ success: false, message: "Appointment not found." });
		}

		if (appointment.status !== "pending") {
			return res.status(400).json({
				success: false,
				message: `Only pending appointments can be cancelled. This appointment is ${appointment.status}.`,
			});
		}

		appointment.status = "cancelled";
		await appointment.save();

		res.status(200).json({ success: true, data: appointment });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Customer: Dashboard Stats & History
export const getCustomerDashboard = async (req: AuthRequest, res: Response) => {
	try {
		const customerId = new mongoose.Types.ObjectId(req.user!.id);

		const [appointments, transactions] = await Promise.all([
			Appointment.find({ customerId })
				.populate(
					"serviceId",
					"serviceName category duration image status",
				)
				.sort({ createdAt: -1 }),
			Transaction.find({ customerId })
				.populate("appointmentId", "appointmentDate timeSlot")
				.sort({ createdAt: -1 }),
		]);

		const stats = {
			totalAppointments: appointments.length,
			pendingCount: appointments.filter((a) => a.status === "pending")
				.length,
			confirmedCount: appointments.filter(
				(a) => a.status === "confirmed",
			).length,
			cancelledCount: appointments.filter(
				(a) => a.status === "cancelled",
			).length,
			totalSpent: transactions
				.filter((t) => t.status === "paid")
				.reduce((sum, t) => sum + t.amount, 0),
		};

		res.status(200).json({
			success: true,
			data: { stats, appointments, transactions },
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};
