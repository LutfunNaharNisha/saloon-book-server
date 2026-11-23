import mongoose, { Document, Schema, Types } from "mongoose";

export interface ITransaction extends Document {
	appointmentId: Types.ObjectId;
	customerId: Types.ObjectId;
	amount: number;
	currency: string;
	stripeSessionId: string;
	status: "paid" | "failed";
	createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
	appointmentId: {
		type: Schema.Types.ObjectId,
		ref: "Appointment",
		required: true,
	},
	customerId: { type: Schema.Types.ObjectId, ref: "users", required: true },
	amount: { type: Number, required: true },
	currency: { type: String, default: "usd" },
	stripeSessionId: { type: String, required: true, unique: true },
	status: { type: String, enum: ["paid", "failed"], required: true },
	createdAt: { type: Date, default: Date.now },
});

TransactionSchema.index({ customerId: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>(
	"Transaction",
	TransactionSchema,
	"transactions",
);
