import { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { mongoClient } from "../config/db";

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	role: string;
	isBlocked: boolean;
}

export interface AuthRequest extends Request {
	user?: AuthUser;
}

/**
 * Better Auth (and its `/api/auth/jwks` endpoint) lives in the frontend app.
 * The backend only verifies the JWTs that the frontend issues for the session.
 * `AUTH_URL` must match the frontend's `BETTER_AUTH_URL` so the issuer,
 * audience and signing keys all line up.
 */
const authUrl =
	process.env.AUTH_URL ||
	process.env.CLIENT_URL ||
	"http://localhost:3000";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const getJwks = () => {
	if (!jwks) {
		jwks = createRemoteJWKSet(new URL(`${authUrl}/api/auth/jwks`));
	}
	return jwks;
};

const usersCollection = () => mongoClient.db().collection("users");

/**
 * Verifies a Better Auth issued JWT (Bearer token) using the frontend's JWKS
 * endpoint, then loads the freshest role/blocked state from MongoDB.
 */
const getUserFromJwt = async (token: string): Promise<AuthUser | null> => {
	const { payload } = await jwtVerify(token, getJwks(), {
		issuer: authUrl,
		audience: authUrl,
	});

	const rawId = payload.sub || (payload as Record<string, unknown>).id;
	const id = typeof rawId === "string" ? rawId : "";
	if (!id || !ObjectId.isValid(id)) return null;

	const user = await usersCollection().findOne({ _id: new ObjectId(id) });
	if (!user) return null;

	return {
		id,
		email: String(user.email || ""),
		name: String(user.name || ""),
		role: String(user.role || "customer"),
		isBlocked: Boolean(user.isBlocked),
	};
};

export const authenticate = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({
			success: false,
			message: "Unauthorized: please sign in.",
		});
		return;
	}

	try {
		const user = await getUserFromJwt(authHeader.slice(7).trim());

		if (!user) {
			res.status(401).json({
				success: false,
				message: "Unauthorized: please sign in.",
			});
			return;
		}

		if (user.isBlocked) {
			res.status(403).json({
				success: false,
				message:
					"Your account has been suspended. Please contact the salon administrator.",
			});
			return;
		}

		req.user = user;
		next();
	} catch {
		res.status(401).json({
			success: false,
			message: "Invalid or expired token.",
		});
	}
};

export const authorizeAdmin = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): void => {
	if (!req.user || req.user.role !== "admin") {
		res.status(403).json({
			success: false,
			message: "Forbidden: admin privileges are required.",
		});
		return;
	}
	next();
};

export const authorizeCustomer = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
): void => {
	if (!req.user || req.user.role !== "customer") {
		res.status(403).json({
			success: false,
			message:
				"Forbidden: only customer accounts can perform this action.",
		});
		return;
	}
	next();
};
