import { Router } from "express";
import {
	createCheckoutSession,
	getMyTransactions,
	verifyCheckoutSession,
} from "../controllers/payment.controller.js";
import {
	authenticate,
	authorizeCustomer,
} from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate, authorizeCustomer);

router.post("/create-checkout-session", createCheckoutSession);
router.get("/verify-session", verifyCheckoutSession);
router.get("/my-transactions", getMyTransactions);

export default router;
