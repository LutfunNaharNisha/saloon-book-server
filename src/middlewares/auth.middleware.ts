import { createPublicKey, type JsonWebKey, type KeyObject } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getMongoClient } from "../config/db.js";

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
 * This API only verifies the JWTs that the frontend issues for the session.
 * `AUTH_URL` must match the frontend's `BETTER_AUTH_URL` so the issuer,
 * audience and signing keys all line up.
 */
const PRODUCTION_CLIENT_URL = "https://saloon-book-client.vercel.app";

const authUrl = (
	process.env.AUTH_URL ||
	process.env.CLIENT_URL ||
	(process.env.VERCEL
		? PRODUCTION_CLIENT_URL
		: "http://localhost:3000")
)
	.split(",")[0]
	.trim()
	.replace(/\/$/, "");

// A deployed API must verify JWTs against the deployed client origin - never
// against a local URL - otherwise tokens issued for the production client are
// rejected with `401 Invalid or expired token`.
const resolvedAuthBaseURL =
	/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(authUrl) &&
	process.env.VERCEL
		? PRODUCTION_CLIENT_URL
		: authUrl;

const jwksUrl = `${resolvedAuthBaseURL}/api/auth/jwks`;

/**
 * JsonWebToken is used for decoding and validating the token; the public key
 * comes from the frontend's JWKS endpoint and is cached per key id so a cold
 * start only needs a single network round trip.
 */
type Jwk = JsonWebKey & { kid?: string; alg?: string };

/** jsonwebtoken can verify any asymmetric algorithm supported by Node. */
const SUPPORTED_ALGORITHMS = [
	"RS256",
	"RS384",
	"RS512",
	"PS256",
	"PS384",
	"PS512",
	"ES256",
	"ES384",
	"ES512",
] as const;

const publicKeys = new Map<string, KeyObject>();
let jwksRequest: Promise<Jwk[]> | null = null;

const fetchJwks = (): Promise<Jwk[]> => {
	if (!jwksRequest) {
		jwksRequest = (async () => {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 5000);
			try {
				const response = await fetch(jwksUrl, {
					signal: controller.signal,
					headers: { accept: "application/json" },
				});
				if (!response.ok) {
					throw new Error(`JWKS request failed with ${response.status}`);
				}
				const body = (await response.json()) as { keys?: Jwk[] };
				if (!Array.isArray(body.keys) || body.keys.length === 0) {
					throw new Error("JWKS response did not contain any keys");
				}
				return body.keys;
			} finally {
				clearTimeout(timeout);
			}
		})().catch((error) => {
			// Allow a later request to retry after a transient failure.
			jwksRequest = null;
			throw error;
		});
	}
	return jwksRequest;
};

const keyFromJwk = (jwk: Jwk): KeyObject =>
	createPublicKey({ key: jwk, format: "jwk" });

/** Resolve the public key for a token, forcing one JWKS refresh on a new kid. */
const getPublicKey = async (kid?: string): Promise<KeyObject> => {
	if (kid && publicKeys.has(kid)) return publicKeys.get(kid)!;

	const keys = await fetchJwks();
	let fallback: KeyObject | undefined;

	for (const jwk of keys) {
		let key: KeyObject;
		try {
			key = keyFromJwk(jwk);
		} catch {
			continue;
		}
		if (jwk.kid) publicKeys.set(jwk.kid, key);
		if (!kid || jwk.kid === kid) return key;
		fallback ??= key;
	}

	if (fallback && !kid) return fallback;
	throw new Error(`No JWKS key found for kid "${kid ?? "<none>"}"`);
};

const getSigningKey = async (token: string): Promise<KeyObject> => {
	const decoded = jwt.decode(token, { complete: true });
	if (!decoded || typeof decoded === "string") {
		throw new Error("Malformed JWT");
	}

	try {
		return await getPublicKey(decoded.header.kid);
	} catch {
		// A key may have rotated since the JWKS was cached. Refresh once.
		jwksRequest = null;
		publicKeys.clear();
		return getPublicKey(decoded.header.kid);
	}
};

const usersCollection = () => getMongoClient().db().collection("users");

/**
 * Verifies a frontend-issued JWT against the frontend JWKS, then loads the
 * freshest role/blocked state from MongoDB.
 */
const getUserFromJwt = async (token: string): Promise<AuthUser | null> => {
	const key = await getSigningKey(token);
	const payload = jwt.verify(token, key, {
		algorithms: [...SUPPORTED_ALGORITHMS],
		issuer: resolvedAuthBaseURL,
		audience: resolvedAuthBaseURL,
	}) as jwt.JwtPayload;

	const rawId = payload.sub || payload.id;
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
