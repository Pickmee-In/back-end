import { Router } from "express";

import { getItemById, getNearbyItems } from "../controllers/map.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// All map endpoints require a valid session
router.use(authenticate);

/**
 * GET /api/map/nearby
 * Returns clothing items with coordinates as map markers.
 * Supports ?latitude, ?longitude, ?maxDistanceKm, ?listingType, ?q, ?limit
 */
router.get("/nearby", getNearbyItems);

/**
 * GET /api/map/items/:id
 * Returns a single item's full details (for the bottom detail card).
 */
router.get("/items/:id", getItemById);

export default router;
