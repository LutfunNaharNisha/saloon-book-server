"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminDashboard = exports.getAllTransactions = exports.toggleCustomerBlock = exports.getAllCustomers = exports.updateAppointmentStatus = exports.getAllAppointments = void 0;
const db_1 = require("../config/db");
const Appointment_1 = require("../models/Appointment");
const Service_1 = require("../models/Service");
const Transaction_1 = require("../models/Transaction");
const params_1 = require("../utils/params");
const usersCollection = () => db_1.mongoClient.db().collection("users");
// Admin: View All Appointment Requests
const getAllAppointments = async (req, res) => {
    try {
        const { status, search } = req.query;
        const match = {};
        if (status && status !== "all")
            match.status = status;
        const pipeline = [
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
        const appointments = await Appointment_1.Appointment.aggregate(pipeline);
        res.status(200).json({ success: true, data: appointments });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllAppointments = getAllAppointments;
// Admin: Confirm or Cancel Appointment Request
const updateAppointmentStatus = async (req, res) => {
    try {
        const appointmentId = (0, params_1.getObjectIdParam)(req.params.id);
        if (!appointmentId) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid appointment ID." });
        }
        const { status } = req.body;
        if (!status || !["confirmed", "cancelled"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be either confirmed or cancelled.",
            });
        }
        const appointment = await Appointment_1.Appointment.findById(appointmentId);
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
        appointment.status = status;
        await appointment.save();
        res.status(200).json({ success: true, data: appointment });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateAppointmentStatus = updateAppointmentStatus;
// Admin: Manage Registered Customers (List with appointment counts)
const getAllCustomers = async (_req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllCustomers = getAllCustomers;
// Admin: Block / Unblock Customer
const toggleCustomerBlock = async (req, res) => {
    try {
        const customerId = (0, params_1.getObjectIdParam)(req.params.id);
        if (!customerId) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid customer ID." });
        }
        const { isBlocked } = req.body;
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
        const result = await usersCollection().findOneAndUpdate({ _id: customerId }, { $set: { isBlocked } }, { returnDocument: "after" });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.toggleCustomerBlock = toggleCustomerBlock;
// Admin: View All Payment Transactions
const getAllTransactions = async (_req, res) => {
    try {
        const transactions = await Transaction_1.Transaction.aggregate([
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllTransactions = getAllTransactions;
// Admin: Dashboard Metrics
const getAdminDashboard = async (_req, res) => {
    try {
        const [totalCustomers, totalActiveServices, totalServices, totalAppointments, pendingAppointments, confirmedAppointments, cancelledAppointments, successfulPayments, paidTransactions, recentAppointments,] = await Promise.all([
            usersCollection().countDocuments({ role: "customer" }),
            Service_1.Service.countDocuments({ status: "active" }),
            Service_1.Service.countDocuments(),
            Appointment_1.Appointment.countDocuments(),
            Appointment_1.Appointment.countDocuments({ status: "pending" }),
            Appointment_1.Appointment.countDocuments({ status: "confirmed" }),
            Appointment_1.Appointment.countDocuments({ status: "cancelled" }),
            Transaction_1.Transaction.countDocuments({ status: "paid" }),
            Transaction_1.Transaction.find({ status: "paid" }),
            Appointment_1.Appointment.aggregate([
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
        const totalRevenue = paidTransactions.reduce((sum, tx) => sum + tx.amount, 0);
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAdminDashboard = getAdminDashboard;
