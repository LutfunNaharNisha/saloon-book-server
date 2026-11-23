import { Router } from "express";
import {
	createCheckoutSession,
	getMyTransactions,
	verifyCheckoutSession,
} from "../controllers/payment.controller";
import {
	authenticate,
	authorizeCustomer,
} from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorizeCustomer);

router.post("/create-checkout-session", createCheckoutSession);
router.get("/verify-session", verifyCheckoutSession);
router.get("/my-transactions", getMyTransactions);

export default router;
