"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service_controller_1 = require("../controllers/service.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public
router.get("/", service_controller_1.getServices);
router.get("/:id", service_controller_1.getServiceById);
// Admin only (client uploads images to ImgBB first, then sends the URL)
router.post("/", auth_middleware_1.authenticate, auth_middleware_1.authorizeAdmin, service_controller_1.createService);
router.patch("/:id", auth_middleware_1.authenticate, auth_middleware_1.authorizeAdmin, service_controller_1.updateService);
router.delete("/:id", auth_middleware_1.authenticate, auth_middleware_1.authorizeAdmin, service_controller_1.deleteService);
exports.default = router;
