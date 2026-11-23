import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAppointment extends Document {
	serviceId: Types.ObjectId;
	customerId: Types.ObjectId;
	appointmentDate: Date;
	timeSlot: string;
	message?: string;
	servicePrice: number;
	paymentStatus: "unpaid" | "paid";
	status: "pending" | "confirmed" | "cancelled";
	createdAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
	serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
	customerId: { type: Schema.Types.ObjectId, ref: "users", required: true },
	appointmentDate: { type: Date, required: true },
	timeSlot: { type: String, required: true },
	message: { type: String, default: "" },
	servicePrice: { type: Number, required: true },
	paymentStatus: {
		type: String,
		enum: ["unpaid", "paid"],
		default: "unpaid",
	},
	status: {
		type: String,
		enum: ["pending", "confirmed", "cancelled"],
		default: "pending",
	},
	createdAt: { type: Date, default: Date.now },
});

AppointmentSchema.index({ customerId: 1, createdAt: -1 });
AppointmentSchema.index({ appointmentDate: 1, timeSlot: 1, status: 1 });

export const Appointment = mongoose.model<IAppointment>(
	"Appointment",
	AppointmentSchema,
	"appointments",
);
