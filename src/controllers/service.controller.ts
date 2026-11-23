import { Request, Response } from "express";
import { Service } from "../models/Service.js";
import { getObjectIdParam } from "../utils/params.js";
import { isValidImageUrl } from "../utils/url.js";

// Public: Browse, search by name, filter by category, sort by price/date
export const getServices = async (req: Request, res: Response) => {
	try {
		const { search, category, sort } = req.query;
		const filter: Record<string, unknown> = { status: "active" };

		if (search && String(search).trim()) {
			filter.serviceName = {
				$regex: String(search).trim(),
				$options: "i",
			};
		}

		if (category && category !== "all") {
			filter.category = { $regex: `^${String(category)}$`, $options: "i" };
		}

		const sortOption: Record<string, 1 | -1> =
			sort === "price-asc"
				? { price: 1 }
				: sort === "price-desc"
					? { price: -1 }
					: { createdAt: -1 };

		const services = await Service.find(filter).sort(sortOption);
		res.status(200).json({
			success: true,
			count: services.length,
			data: services,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Public: View Service Details
export const getServiceById = async (req: Request, res: Response) => {
	try {
		const serviceId = getObjectIdParam(req.params.id);
		if (!serviceId) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid service ID." });
		}

		const service = await Service.findById(serviceId);
		if (!service) {
			return res
				.status(404)
				.json({ success: false, message: "Service not found." });
		}
		res.status(200).json({ success: true, data: service });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: View every service (active + inactive)
export const getAdminServices = async (req: Request, res: Response) => {
	try {
		const { search, category, status, sort } = req.query;
		const filter: Record<string, unknown> = {};

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

		const sortOption: Record<string, 1 | -1> =
			sort === "price-asc"
				? { price: 1 }
				: sort === "price-desc"
					? { price: -1 }
					: { createdAt: -1 };

		const services = await Service.find(filter).sort(sortOption);
		res.status(200).json({
			success: true,
			count: services.length,
			data: services,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// Admin: Add Service (receives an ImgBB URL from the client uploader)
export const createService = async (req: Request, res: Response) => {
	try {
		const {
			serviceName,
			category,
			description,
			price,
			duration,
			image,
			status,
		} = req.body;

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

		if (!isValidImageUrl(image)) {
			return res.status(400).json({
				success: false,
				message:
					"Invalid image URL. Please upload the image again and retry.",
			});
		}

		const service = await Service.create({
			serviceName: String(serviceName).trim(),
			category: String(category).trim(),
			description: String(description).trim(),
			price: numericPrice,
			duration: numericDuration,
			image,
			status: status === "inactive" ? "inactive" : "active",
		});

		res.status(201).json({ success: true, data: service });
	} catch (error: any) {
		res.status(400).json({ success: false, message: error.message });
	}
};

// Admin: Update Service
export const updateService = async (req: Request, res: Response) => {
	try {
		const serviceId = getObjectIdParam(req.params.id);
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
		const updates: Record<string, unknown> = {};
		for (const key of allowed) {
			if (req.body[key] !== undefined) updates[key] = req.body[key];
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
			if (!isValidImageUrl(String(updates.image))) {
				return res.status(400).json({
					success: false,
					message:
						"Invalid image URL. Please upload the image again and retry.",
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

		const service = await Service.findByIdAndUpdate(serviceId, updates, {
			new: true,
			runValidators: true,
		});

		if (!service) {
			return res
				.status(404)
				.json({ success: false, message: "Service not found." });
		}

		res.status(200).json({ success: true, data: service });
	} catch (error: any) {
		res.status(400).json({ success: false, message: error.message });
	}
};

// Admin: Delete Service
export const deleteService = async (req: Request, res: Response) => {
	try {
		const serviceId = getObjectIdParam(req.params.id);
		if (!serviceId) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid service ID." });
		}

		const service = await Service.findByIdAndDelete(serviceId);
		if (!service) {
			return res
				.status(404)
				.json({ success: false, message: "Service not found." });
		}
		res.status(200).json({
			success: true,
			message: "Service deleted successfully.",
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};
