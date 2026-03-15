/**
 * Authentication Routes
 */

import { Router } from "express";
import {
    googleAuth,
    refreshToken,
    logout,
    completeProfile,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate, authValidation } from "../middleware/validate.js";

const router = Router();

// Public routes
router.post("/google", validate(authValidation.googleAuth), googleAuth);
router.post("/refresh", validate(authValidation.refreshToken), refreshToken);

// Protected routes
router.post("/logout", authenticate, logout);
router.put(
    "/complete-profile",
    authenticate,
    validate(authValidation.completeProfile),
    completeProfile
);

export default router;
