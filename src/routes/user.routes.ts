/**
 * User Routes
 */

import { Router } from "express";
import {
    getCurrentUser,
    getCurrentUserStats,
    updateCurrentUser,
    updateAvatar,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { avatarUpload } from "../middleware/upload.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get("/me", getCurrentUser);
router.get("/me/stats", getCurrentUserStats);
router.patch("/me", updateCurrentUser);
router.patch("/me/avatar", avatarUpload.single("avatar"), updateAvatar);

export default router;
