"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteService = exports.updateService = exports.createService = exports.getAdminServices = exports.getServiceById = exports.getServices = void 0;
const Service_1 = require("../models/Service");
const params_1 = require("../utils/params");
const url_1 = require("../utils/url");
// Public: Browse, search by name, filter by category, sort by price/date
const getServices = async (req, res) => {
    try {
        const { search, category, sort } = req.query;
        const filter = { status: "active" };
        if (search && String(search).trim()) {
            filter.serviceName = {
                $regex: String(search).trim(),
                $options: "i",
            };
        }
        if (category && category !== "all") {
            filter.category = { $regex: `^${String(category)}$`, $options: "i" };
        }
        const sortOption = sort === "price-asc"
            ? { price: 1 }
            : sort === "price-desc"
                ? { price: -1 }
                : { createdAt: -1 };
        const services = await Service_1.Service.find(filter).sort(sortOption);
        res.status(200).json({
            success: true,
            count: services.length,
            data: services,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getServices = getServices;
// Public: View Service Details
const getServiceById = async (req, res) => {
    try {
        const serviceId = (0, params_1.getObjectIdParam)(req.params.id);
        if (!serviceId) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid service ID." });
        }
        const service = await Service_1.Service.findById(serviceId);
        if (!service) {
            return res
                .status(404)
                .json({ success: false, message: "Service not found." });
        }
        res.status(200).json({ success: true, data: service });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getServiceById = getServiceById;
// Admin: View every service (active + inactive)
const getAdminServices = async (req, res) => {
    try {
        const { search, category, status, sort } = req.query;
        const filter = {};
        if (search && String(search).trim()) {
            filter.serviceName = {
                $regex: String(search).trim(),
                $options: "i",
            };
        }
        if (category && category !== "all") {
            filter.category = { $regex: `^${String(category)}$`, $options: "i" };
        }
        if (status && status !== "all") {
            filter.status = status;
        }
        const sortOption = sort === "price-asc"
            ? { price: 1 }
            : sort === "price-desc"
                ? { price: -1 }
                : { createdAt: -1 };
        const services = await Service_1.Service.find(filter).sort(sortOption);
        res.status(200).json({
            success: true,
            count: services.length,
            data: services,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAdminServices = getAdminServices;
// Admin: Add Service (receives an ImgBB URL from the client uploader)
const createService = async (req, res) => {
    try {
        const { serviceName, category, description, price, duration, image, status, } = req.body;
        if (!serviceName || !category || !description) {
            return res.status(400).json({
                success: false,
                message: "Name, category and description are required.",
            });
        }
        const numericPrice = Number(price);
        const numericDuration = Number(duration);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a positive number.",
            });
        }
        if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
            return res.status(400).json({
                success: false,
                message: "Duration must be a positive number of minutes.",
            });
        }
        if (!image) {
            return res.status(400).json({
                success: false,
                message: "A service image is required.",
            });
        }
        if (!(0, url_1.isValidImageUrl)(image)) {
            return res.status(400).json({
                success: false,
                message: "Invalid image URL. Please upload the image again and retry.",
            });
        }
        const service = await Service_1.Service.create({
            serviceName: String(serviceName).trim(),
            category: String(category).trim(),
            description: String(description).trim(),
            price: numericPrice,
            duration: numericDuration,
            image,
            status: status === "inactive" ? "inactive" : "active",
        });
        res.status(201).json({ success: true, data: service });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.createService = createService;
// Admin: Update Service
const updateService = async (req, res) => {
    try {
        const serviceId = (0, params_1.getObjectIdParam)(req.params.id);
        if (!serviceId) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid service ID." });
        }
        const allowed = [
            "serviceName",
            "category",
            "description",
            "price",
            "duration",
            "image",
            "status",
        ];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined)
                updates[key] = req.body[key];
        }
        if (updates.price !== undefined) {
            const value = Number(updates.price);
            if (!Number.isFinite(value) || value <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be a positive number.",
                });
            }
            updates.price = value;
        }
        if (updates.duration !== undefined) {
            const value = Number(updates.duration);
            if (!Number.isFinite(value) || value <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Duration must be a positive number of minutes.",
                });
            }
            updates.duration = value;
        }
        if (updates.image !== undefined && updates.image !== "") {
            if (!(0, url_1.isValidImageUrl)(String(updates.image))) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image URL. Please upload the image again and retry.",
                });
            }
        }
        if (updates.status !== undefined && updates.status !== "") {
            if (!["active", "inactive"].includes(String(updates.status))) {
                return res.status(400).json({
                    success: false,
                    message: "Status must be either active or inactive.",
                });
            }
        }
        const service = await Service_1.Service.findByIdAndUpdate(serviceId, updates, {
            new: true,
            runValidators: true,
        });
        if (!service) {
            return res
                .status(404)
                .json({ success: false, message: "Service not found." });
        }
        res.status(200).json({ success: true, data: service });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.updateService = updateService;
// Admin: Delete Service
const deleteService = async (req, res) => {
    try {
        const serviceId = (0, params_1.getObjectIdParam)(req.params.id);
        if (!serviceId) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid service ID." });
        }
        const service = await Service_1.Service.findByIdAndDelete(serviceId);
        if (!service) {
            return res
                .status(404)
                .json({ success: false, message: "Service not found." });
        }
        res.status(200).json({
            success: true,
            message: "Service deleted successfully.",
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteService = deleteService;
