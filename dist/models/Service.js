import mongoose, { Schema } from "mongoose";
const ServiceSchema = new Schema({
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
export const Service = mongoose.model("Service", ServiceSchema, "services");
