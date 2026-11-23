import mongoose, { Schema } from "mongoose";
const TransactionSchema = new Schema({
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
export const Transaction = mongoose.model("Transaction", TransactionSchema, "transactions");
