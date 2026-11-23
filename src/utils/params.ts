import mongoose from "mongoose";

export const getObjectIdParam = (
	value: string | string[] | undefined,
): mongoose.Types.ObjectId | null => {
	const id = Array.isArray(value) ? value[0] : value;
	if (!id || !mongoose.Types.ObjectId.isValid(id)) {
		return null;
	}
	return new mongoose.Types.ObjectId(id);
};
