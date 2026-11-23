import { Response } from "express";
import { getMongoClient } from "../config/db";
import { AuthRequest } from "../middlewares/auth.middleware";
import { Appointment } from "../models/Appointment";
import { Service } from "../models/Service";
import { Transaction } from "../models/Transaction";
import { getObjectIdParam } from "../utils/params";

const usersCollection = () => getMongoClient().db().collection("users");

// Admin: View All Appointment Requests
export const getAllAppointments = async (req: AuthRequest, res: Response) => {
	try {
		const { status, search } = req.query;
		const match: Record<string, unknown> = {};
		if (status && status !== "all") match.status = status;

		const pipeline: any[] = [
			{ $match: match },
			{ $sort: { createdAt: -1 } },
			{
				$lookup: {
					from: "services",
					localField: "serviceId",
					foreignField: "_id",
					as: "service",
				},
			},
			{ $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: "users",
					localField: "customerId",
					foreignField: "_id",
					as: "customer",
				},
			},
			{ $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
			{
				$project: {
					"customer.emailVerified": 0,
					"customer.createdAt": 0,
					"customer.updatedAt": 0,
				},
			},
		];

		if (search && String(search).trim()) {
			const regex = { $regex: String(search).trim(), $options: "i" };
			pipeline.push({
				$match: {
					$or: [
						{ "customer.name": regex },
						{ "customer.email": regex },
						{ "service.serviceName": regex },
					],
				},
			});
		}

		const appointments = await Appointment.aggregate(pipeline);
		res.status(200).json({ success: true, data: appointments });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: Confirm or Cancel Appointment Request
export const updateAppointmentStatus = async (
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

		const { status } = req.body as { status?: string };
		if (!status || !["confirmed", "cancelled"].includes(status)) {
			return res.status(400).json({
				success: false,
				message: "Status must be either confirmed or cancelled.",
			});
		}

		const appointment = await Appointment.findById(appointmentId);
		if (!appointment) {
			return res
				.status(404)
				.json({ success: false, message: "Appointment not found." });
		}

		if (appointment.status === "cancelled") {
			return res.status(400).json({
				success: false,
				message: "A cancelled appointment cannot be changed.",
			});
		}

		if (status === "confirmed" && appointment.status !== "pending") {
			return res.status(400).json({
				success: false,
				message: "Only pending appointments can be confirmed.",
			});
		}

		appointment.status = status as "confirmed" | "cancelled";
		await appointment.save();

		res.status(200).json({ success: true, data: appointment });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: Manage Registered Customers (List with appointment counts)
export const getAllCustomers = async (_req: AuthRequest, res: Response) => {
	try {
		const customers = await usersCollection()
			.aggregate([
				{ $match: { role: { $ne: "admin" } } },
				{ $sort: { createdAt: -1 } },
				{
					$lookup: {
						from: "appointments",
						localField: "_id",
						foreignField: "customerId",
						as: "appointments",
					},
				},
				{
					$addFields: {
						appointmentCount: { $size: "$appointments" },
					},
				},
				{
					$project: {
						appointments: 0,
						emailVerified: 0,
					},
				},
			])
			.toArray();

		res.status(200).json({ success: true, data: customers });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: Block / Unblock Customer
export const toggleCustomerBlock = async (req: AuthRequest, res: Response) => {
	try {
		const customerId = getObjectIdParam(req.params.id);
		if (!customerId) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid customer ID." });
		}

		const { isBlocked } = req.body as { isBlocked?: boolean };
		if (typeof isBlocked !== "boolean") {
			return res.status(400).json({
				success: false,
				message: "isBlocked must be a boolean value.",
			});
		}

		const target = await usersCollection().findOne({ _id: customerId });
		if (!target) {
			return res
				.status(404)
				.json({ success: false, message: "Customer not found." });
		}
		if (target.role === "admin") {
			return res.status(400).json({
				success: false,
				message: "Administrator accounts cannot be blocked.",
			});
		}

		const result = await usersCollection().findOneAndUpdate(
			{ _id: customerId },
			{ $set: { isBlocked } },
			{ returnDocument: "after" },
		);

		res.status(200).json({ success: true, data: result });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: View All Payment Transactions
export const getAllTransactions = async (_req: AuthRequest, res: Response) => {
	try {
		const transactions = await Transaction.aggregate([
			{ $sort: { createdAt: -1 } },
			{
				$lookup: {
					from: "users",
					localField: "customerId",
					foreignField: "_id",
					as: "customer",
				},
			},
			{ $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: "appointments",
					localField: "appointmentId",
					foreignField: "_id",
					as: "appointment",
				},
			},
			{
				$unwind: {
					path: "$appointment",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$lookup: {
					from: "services",
					localField: "appointment.serviceId",
					foreignField: "_id",
					as: "service",
				},
			},
			{ $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
			{
				$project: {
					"customer.emailVerified": 0,
				},
			},
		]);

		res.status(200).json({ success: true, data: transactions });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: Dashboard Metrics
export const getAdminDashboard = async (_req: AuthRequest, res: Response) => {
	try {
		const [
			totalCustomers,
			totalActiveServices,
			totalServices,
			totalAppointments,
			pendingAppointments,
			confirmedAppointments,
			cancelledAppointments,
			successfulPayments,
			paidTransactions,
			recentAppointments,
		] = await Promise.all([
			usersCollection().countDocuments({ role: "customer" }),
			Service.countDocuments({ status: "active" }),
			Service.countDocuments(),
			Appointment.countDocuments(),
			Appointment.countDocuments({ status: "pending" }),
			Appointment.countDocuments({ status: "confirmed" }),
			Appointment.countDocuments({ status: "cancelled" }),
			Transaction.countDocuments({ status: "paid" }),
			Transaction.find({ status: "paid" }),
			Appointment.aggregate([
				{ $sort: { createdAt: -1 } },
				{ $limit: 5 },
				{
					$lookup: {
						from: "services",
						localField: "serviceId",
						foreignField: "_id",
						as: "service",
					},
				},
				{
					$unwind: {
						path: "$service",
						preserveNullAndEmptyArrays: true,
					},
				},
				{
					$lookup: {
						from: "users",
						localField: "customerId",
						foreignField: "_id",
						as: "customer",
					},
				},
				{
					$unwind: {
						path: "$customer",
						preserveNullAndEmptyArrays: true,
					},
				},
			]),
		]);

		const totalRevenue = paidTransactions.reduce(
			(sum, tx) => sum + tx.amount,
			0,
		);

		res.status(200).json({
			success: true,
			data: {
				totalCustomers,
				totalActiveServices,
				totalServices,
				totalAppointments,
				pendingAppointments,
				confirmedAppointments,
				cancelledAppointments,
				successfulPayments,
				totalRevenue,
				recentAppointments,
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};
