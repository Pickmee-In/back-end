/**
 * Restaurant Routes
 * Endpoints for restaurant discovery and favorites
 */

import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import {
    searchNearby,
    searchWithPreferences,
    getRestaurant,
    getRestaurantDetails,
    addToFavorites,
    removeFromFavorites,
    getFavorites,
    checkFavorited,
} from "../controllers/restaurant.controller.js";

const router = Router();

// Public routes (with optional auth for personalized results)
router.get("/nearby", optionalAuthenticate, searchNearby);
router.post("/search", optionalAuthenticate, searchWithPreferences);

// Protected routes - Favorites (must be before /:id to avoid conflict)
router.get("/favorites", authenticate, getFavorites);
router.post("/favorites", authenticate, addToFavorites);
router.delete("/favorites/:restaurantId", authenticate, removeFromFavorites);

// Restaurant details
router.get("/place/:placeId", getRestaurantDetails);
router.get("/:id/favorited", authenticate, checkFavorited);
router.get("/:id", getRestaurant);

export default router;
