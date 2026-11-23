import { Router } from "express";
import {
	getAdminDashboard,
	getAllAppointments,
	getAllCustomers,
	getAllTransactions,
	toggleCustomerBlock,
	updateAppointmentStatus,
} from "../controllers/admin.controller";
import { getAdminServices } from "../controllers/service.controller";
import { authenticate, authorizeAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorizeAdmin);

router.get("/dashboard", getAdminDashboard);
router.get("/services", getAdminServices);
router.get("/appointments", getAllAppointments);
router.patch("/appointments/:id/status", updateAppointmentStatus);
router.get("/customers", getAllCustomers);
router.patch("/customers/:id/block", toggleCustomerBlock);
router.get("/transactions", getAllTransactions);

export default router;
