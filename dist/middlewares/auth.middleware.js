"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeCustomer = exports.authorizeAdmin = exports.authenticate = void 0;
const jose_1 = require("jose");
const mongodb_1 = require("mongodb");
const db_1 = require("../config/db");
/**
 * Better Auth (and its `/api/auth/jwks` endpoint) lives in the frontend app.
 * The backend only verifies the JWTs that the frontend issues for the session.
 * `AUTH_URL` must match the frontend's `BETTER_AUTH_URL` so the issuer,
 * audience and signing keys all line up.
 */
const authUrl = process.env.AUTH_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000";
let jwks = null;
const getJwks = () => {
    if (!jwks) {
        jwks = (0, jose_1.createRemoteJWKSet)(new URL(`${authUrl}/api/auth/jwks`));
    }
    return jwks;
};
const usersCollection = () => db_1.mongoClient.db().collection("users");
/**
 * Verifies a Better Auth issued JWT (Bearer token) using the frontend's JWKS
 * endpoint, then loads the freshest role/blocked state from MongoDB.
 */
const getUserFromJwt = async (token) => {
    const { payload } = await (0, jose_1.jwtVerify)(token, getJwks(), {
        issuer: authUrl,
        audience: authUrl,
    });
    const rawId = payload.sub || payload.id;
    const id = typeof rawId === "string" ? rawId : "";
    if (!id || !mongodb_1.ObjectId.isValid(id))
        return null;
    const user = await usersCollection().findOne({ _id: new mongodb_1.ObjectId(id) });
    if (!user)
        return null;
    return {
        id,
        email: String(user.email || ""),
        name: String(user.name || ""),
        role: String(user.role || "customer"),
        isBlocked: Boolean(user.isBlocked),
    };
};
const authenticate = async (req, res, next) => {
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
                message: "Your account has been suspended. Please contact the salon administrator.",
            });
            return;
        }
        req.user = user;
        next();
    }
    catch {
        res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }
};
exports.authenticate = authenticate;
const authorizeAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
        res.status(403).json({
            success: false,
            message: "Forbidden: admin privileges are required.",
        });
        return;
    }
    next();
};
exports.authorizeAdmin = authorizeAdmin;
const authorizeCustomer = (req, res, next) => {
    if (!req.user || req.user.role !== "customer") {
        res.status(403).json({
            success: false,
            message: "Forbidden: only customer accounts can perform this action.",
        });
        return;
    }
    next();
};
exports.authorizeCustomer = authorizeCustomer;
