/**
 * API Routes
 */

import { Router } from "express";
import authRoutes from "./auth.routes.js";
import chatRoutes from "./chat.routes.js";
import exploreRoutes from "./explore.routes.js";
import itemRoutes from "./item.routes.js";
import mapRoutes from "./map.routes.js";
import notificationRoutes from "./notification.routes.js";
import userRoutes from "./user.routes.js";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "pickme-api",
    });
});

// Mount routes
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/users", userRoutes);
router.use("/explore", exploreRoutes);
router.use("/items", itemRoutes);
router.use("/map", mapRoutes);
router.use("/notifications", notificationRoutes);
// Legacy Terserah.in modules are disabled during PickMe auth migration:
// router.use("/restaurants", restaurantRoutes);
// router.use("/groups", groupRoutes);
// router.use("/swipe", swipeRoutes);

export default router;
