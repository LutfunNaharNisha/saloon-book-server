import { Router } from "express";
import {
	createService,
	deleteService,
	getServiceById,
	getServices,
	updateService,
} from "../controllers/service.controller";
import { authenticate, authorizeAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Public
router.get("/", getServices);
router.get("/:id", getServiceById);

// Admin only (client uploads images to ImgBB first, then sends the URL)
router.post("/", authenticate, authorizeAdmin, createService);
router.patch("/:id", authenticate, authorizeAdmin, updateService);
router.delete("/:id", authenticate, authorizeAdmin, deleteService);

export default router;
