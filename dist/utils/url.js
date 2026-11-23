"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidImageUrl = void 0;
const isValidImageUrl = (url) => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    }
    catch {
        return false;
    }
};
exports.isValidImageUrl = isValidImageUrl;
