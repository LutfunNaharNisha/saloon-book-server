import { randomBytes, scrypt, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";

dotenv.config();

import { connectDB, mongoClient } from "../config/db";
import { Service } from "../models/Service";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@salonbook.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Salon Administrator";

const CUSTOMER_EMAIL = process.env.DEMO_CUSTOMER_EMAIL || "customer@salonbook.com";
const CUSTOMER_PASSWORD = process.env.DEMO_CUSTOMER_PASSWORD || "Customer123";
const CUSTOMER_NAME = process.env.DEMO_CUSTOMER_NAME || "Nisha Rahman";

const scryptAsync = promisify(scrypt) as (
	password: string,
	salt: string,
	keylen: number,
	options: ScryptOptions,
) => Promise<Buffer>;

// Matches Better Auth's default password hasher (`@better-auth/utils/password`)
// so seeded users can sign in through the frontend-hosted Better Auth instance.
const SCRYPT_OPTIONS: ScryptOptions = {
	N: 16384,
	r: 16,
	p: 1,
	maxmem: 128 * 16384 * 16 * 2,
};

const hashPassword = async (password: string) => {
	const salt = randomBytes(16).toString("hex");
	const key = await scryptAsync(
		password.normalize("NFKC"),
		salt,
		64,
		SCRYPT_OPTIONS,
	);
	return `${salt}:${key.toString("hex")}`;
};

const seedServices = [
	{
		serviceName: "Signature Cut & Blow Dry",
		category: "Haircut & Styling",
		description:
			"A personalised consultation, precision cut and polished blow-dry finish designed around your face shape and lifestyle.",
		price: 45,
		duration: 60,
		image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Luxury Blowout",
		category: "Haircut & Styling",
		description:
			"Volume, shine and movement. Our signature blowout includes a scalp massage and heat-protective styling.",
		price: 35,
		duration: 45,
		image: "https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Balayage & Gloss",
		category: "Hair Coloring",
		description:
			"Hand-painted balayage with a custom toner and gloss for a sun-kissed, dimensional finish.",
		price: 160,
		duration: 150,
		image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Root Colour Refresh",
		category: "Hair Coloring",
		description:
			"A quick root touch-up to refresh your colour, cover regrowth and restore a seamless finish.",
		price: 75,
		duration: 90,
		image: "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Keratin Repair Treatment",
		category: "Hair Treatment",
		description:
			"An intensive keratin treatment that smooths frizz, strengthens strands and leaves hair silky for weeks.",
		price: 120,
		duration: 120,
		image: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Scalp Detox Ritual",
		category: "Hair Treatment",
		description:
			"A clarifying scalp exfoliation and nourishing mask that rebalances the scalp and boosts shine.",
		price: 55,
		duration: 45,
		image: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Glow Facial",
		category: "Facial & Skincare",
		description:
			"Deep cleansing, gentle exfoliation and a vitamin-rich mask for an instant, radiant glow.",
		price: 70,
		duration: 60,
		image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Hydra Radiance Facial",
		category: "Facial & Skincare",
		description:
			"A hydrating multi-step facial with hyaluronic infusion to plump, soothe and refresh tired skin.",
		price: 95,
		duration: 75,
		image: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Soft Glam Makeup",
		category: "Makeup",
		description:
			"Event-ready soft glam with long-wear products, lash application and a personalised lip shade.",
		price: 85,
		duration: 60,
		image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Bridal Makeup Trial",
		category: "Makeup",
		description:
			"A relaxed trial session to design your wedding look, including skin prep and a photo-ready finish.",
		price: 110,
		duration: 90,
		image: "https://images.unsplash.com/photo-1457972729786-0411a3b2b626?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Gel Manicure",
		category: "Manicure & Pedicure",
		description:
			"Cuticle care, shaping and a chip-resistant gel colour that stays glossy for up to three weeks.",
		price: 40,
		duration: 45,
		image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Spa Pedicure",
		category: "Manicure & Pedicure",
		description:
			"A warm soak, exfoliation, callus care and massage followed by your choice of polish.",
		price: 50,
		duration: 60,
		image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Aromatherapy Massage",
		category: "Spa & Massage",
		description:
			"A full-body relaxation massage with essential oils to release tension and restore calm.",
		price: 100,
		duration: 60,
		image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80",
	},
	{
		serviceName: "Hot Stone Therapy",
		category: "Spa & Massage",
		description:
			"Smooth heated stones and deep tissue techniques melt away stubborn knots and stress.",
		price: 130,
		duration: 90,
		image: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1200&q=80",
	},
];

const ensureAccount = async (
	name: string,
	email: string,
	password: string,
	role: "admin" | "customer",
	image: string,
) => {
	const db = mongoClient.db();
	const users = db.collection("users");
	const accounts = db.collection("account");
	const normalizedEmail = email.toLowerCase();
	const phone =
		role === "admin" ? "+1 (555) 010-2000" : "+1 (555) 010-3000";
	const existing = await users.findOne({ email: normalizedEmail });
	const userId: ObjectId = existing?._id ?? new ObjectId();
	const now = new Date();

	if (existing) {
		console.log(`Account already exists: ${normalizedEmail}`);
	} else {
		await users.insertOne({
			_id: userId,
			name,
			email: normalizedEmail,
			emailVerified: false,
			image,
			role,
			isBlocked: false,
			phone,
			createdAt: now,
			updatedAt: now,
		});
		console.log(`Created account: ${normalizedEmail}`);
	}

	// Better Auth stores credential passwords in the `account` collection.
	const credential = await accounts.findOne({
		userId,
		providerId: "credential",
	});
	if (!credential) {
		await accounts.insertOne({
			userId,
			providerId: "credential",
			accountId: userId.toHexString(),
			password: await hashPassword(password),
			createdAt: now,
			updatedAt: now,
		});
	}

	await users.updateOne(
		{ _id: userId },
		{
			$set: {
				name,
				email: normalizedEmail,
				role,
				isBlocked: false,
				image,
				phone,
				updatedAt: new Date(),
			},
		},
	);

	console.log(`Ensured ${role} role for ${normalizedEmail}`);
};

const run = async () => {
	await connectDB();

	await ensureAccount(
		ADMIN_NAME,
		ADMIN_EMAIL,
		ADMIN_PASSWORD,
		"admin",
		"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
	);

	await ensureAccount(
		CUSTOMER_NAME,
		CUSTOMER_EMAIL,
		CUSTOMER_PASSWORD,
		"customer",
		"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
	);

	for (const service of seedServices) {
		await Service.updateOne(
			{ serviceName: service.serviceName },
			{ $set: { ...service, status: "active" } },
			{ upsert: true },
		);
	}
	console.log(`Seeded ${seedServices.length} salon services.`);

	console.log("\nSeed complete.");
	console.log(`Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
	console.log(`Customer: ${CUSTOMER_EMAIL} / ${CUSTOMER_PASSWORD}`);

	await mongoose.disconnect();
	await mongoClient.close();
	process.exit(0);
};

run().catch(async (error) => {
	console.error("Seed failed:", error);
	await mongoose.disconnect().catch(() => undefined);
	await mongoClient.close().catch(() => undefined);
	process.exit(1);
});
