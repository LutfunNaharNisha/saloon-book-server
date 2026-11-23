import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

let stripeClient: Stripe | null = null;

/**
 * Lazily create the Stripe client. The Stripe constructor throws when no secret
 * key is provided, and doing that at import time crashes every route on a
 * serverless deployment (Vercel) instead of only the payment routes.
 */
export const getStripe = (): Stripe => {
	if (!stripeClient) {
		const secretKey = process.env.STRIPE_SECRET_KEY;
		if (!secretKey) {
			throw new Error(
				"STRIPE_SECRET_KEY is not set. Add it to the environment variables of the server.",
			);
		}
		stripeClient = new Stripe(secretKey, {
			apiVersion: "2024-09-30.acacia" as any,
		});
	}
	return stripeClient;
};
