import mongoose, { Schema, Document } from "mongoose";

export interface IService extends Document {
	serviceName: string;
	category: string;
	description: string;
	price: number;
	duration: number; // in minutes
	image: string;
	status: "active" | "inactive";
	createdAt: Date;
}

const ServiceSchema = new Schema<IService>({
	serviceName: { type: String, required: true, trim: true },
	category: { type: String, required: true, trim: true },
	description: { type: String, required: true },
	price: { type: Number, required: true, min: 0.01 },
	duration: { type: Number, required: true, min: 1 },
	image: { type: String, default: "" },
	status: { type: String, enum: ["active", "inactive"], default: "active" },
	createdAt: { type: Date, default: Date.now },
});

ServiceSchema.index({ serviceName: "text", category: 1 });

export const Service = mongoose.model<IService>(
	"Service",
	ServiceSchema,
	"services",
);
