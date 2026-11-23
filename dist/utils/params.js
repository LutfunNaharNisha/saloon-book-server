"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObjectIdParam = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const getObjectIdParam = (value) => {
    const id = Array.isArray(value) ? value[0] : value;
    if (!id || !mongoose_1.default.Types.ObjectId.isValid(id)) {
        return null;
    }
    return new mongoose_1.default.Types.ObjectId(id);
};
exports.getObjectIdParam = getObjectIdParam;
