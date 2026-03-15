/**
 * Restaurant Controller
 * Handles HTTP request/response for restaurant endpoints
 */

import { Request, Response, NextFunction } from "express";
import { restaurantService } from "../services/restaurant.service.js";
import { z } from "zod";
import { BadRequestError } from "../utils/errors.js";

// Validation schemas
const nearbySearchSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().min(100).max(50000).optional(),
    keyword: z.string().optional(),
    minPrice: z.number().min(0).max(4).optional(),
    maxPrice: z.number().min(0).max(4).optional(),
    openNow: z.boolean().optional(),
});

const preferencesSearchSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    preferences: z
        .object({
            categories: z.array(z.string()).default([]),
            priceRange: z
                .object({
                    min: z.number().default(0),
                    max: z.number().default(500000),
                })
                .default({ min: 0, max: 500000 }),
            maxDistance: z.number().min(1).max(50).default(5),
            minRating: z.number().min(0).max(5).default(3.5),
        })
        .optional(),
    limit: z.number().min(1).max(50).optional(),
});

const addFavoriteSchema = z.object({
    restaurantId: z.string().uuid(),
    note: z.string().max(500).optional(),
    // Optional restaurant data - if provided and restaurant doesn't exist, create it
    restaurantData: z
        .object({
            name: z.string(),
            address: z.string().optional(),
            latitude: z.number(),
            longitude: z.number(),
            rating: z.number().optional(),
            priceLevel: z.number().optional(),
            categories: z.array(z.string()).optional(),
            image: z.string().optional(),
        })
        .optional(),
});

/**
 * Search nearby restaurants
 * GET /api/restaurants/nearby?latitude=...&longitude=...
 */
export async function searchNearby(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const query = {
            latitude: parseFloat(req.query.latitude as string),
            longitude: parseFloat(req.query.longitude as string),
            radius: req.query.radius
                ? parseInt(req.query.radius as string)
                : undefined,
            keyword: req.query.keyword as string | undefined,
            minPrice: req.query.minPrice
                ? parseInt(req.query.minPrice as string)
                : undefined,
            maxPrice: req.query.maxPrice
                ? parseInt(req.query.maxPrice as string)
                : undefined,
            openNow: req.query.openNow === "true",
        };

        const validated = nearbySearchSchema.safeParse(query);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid query parameters: " + validated.error.message
            );
        }

        const restaurants = await restaurantService.searchNearby(
            validated.data
        );

        res.json({
            success: true,
            data: restaurants,
            count: restaurants.length,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Search restaurants with user preferences
 * POST /api/restaurants/search
 */
export async function searchWithPreferences(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validated = preferencesSearchSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const { latitude, longitude, preferences, limit } = validated.data;

        // Use user's preferences from token if not provided
        const userPreferences = preferences ||
            (req as any).user?.preferences || {
                categories: [],
                priceRange: { min: 0, max: 500000 },
                maxDistance: 5,
                minRating: 3.5,
            };

        const restaurants = await restaurantService.searchWithPreferences(
            latitude,
            longitude,
            userPreferences,
            limit
        );

        res.json({
            success: true,
            data: restaurants,
            count: restaurants.length,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get restaurant by ID
 * GET /api/restaurants/:id
 */
export async function getRestaurant(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const restaurant = await restaurantService.getById(id);

        res.json({
            success: true,
            data: restaurant,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get restaurant details by Place ID
 * GET /api/restaurants/place/:placeId
 */
export async function getRestaurantDetails(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { placeId } = req.params;
        const restaurant = await restaurantService.getDetails(placeId);

        res.json({
            success: true,
            data: restaurant,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Add restaurant to favorites
 * POST /api/restaurants/favorites
 */
export async function addToFavorites(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validated = addFavoriteSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const userId = (req as any).user.id;
        const { restaurantId, note, restaurantData } = validated.data;

        const favorite = await restaurantService.addToFavorites(
            userId,
            restaurantId,
            note,
            restaurantData
        );

        res.status(201).json({
            success: true,
            message: "Added to favorites",
            data: favorite,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Remove from favorites
 * DELETE /api/restaurants/favorites/:restaurantId
 */
export async function removeFromFavorites(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = (req as any).user.id;
        const { restaurantId } = req.params;

        await restaurantService.removeFromFavorites(userId, restaurantId);

        res.json({
            success: true,
            message: "Removed from favorites",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get user's favorites
 * GET /api/restaurants/favorites
 */
export async function getFavorites(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = (req as any).user.id;
        const favorites = await restaurantService.getUserFavorites(userId);

        res.json({
            success: true,
            data: favorites,
            count: favorites.length,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Check if restaurant is favorited
 * GET /api/restaurants/:id/favorited
 */
export async function checkFavorited(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const isFavorited = await restaurantService.isFavorited(userId, id);

        res.json({
            success: true,
            data: { isFavorited },
        });
    } catch (error) {
        next(error);
    }
}
