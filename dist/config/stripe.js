"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStripe = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const stripe_1 = __importDefault(require("stripe"));
dotenv_1.default.config();
let stripeClient = null;
/**
 * Lazily create the Stripe client. The Stripe constructor throws when no secret
 * key is provided, and doing that at import time crashes every route on a
 * serverless deployment (Vercel) instead of only the payment routes.
 */
const getStripe = () => {
    if (!stripeClient) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error("STRIPE_SECRET_KEY is not set. Add it to the environment variables of the server.");
        }
        stripeClient = new stripe_1.default(secretKey, {
            apiVersion: "2024-09-30.acacia",
        });
    }
    return stripeClient;
};
exports.getStripe = getStripe;
