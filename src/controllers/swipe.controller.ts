/**
 * Swipe Controller
 * Handles HTTP request/response for swipe session endpoints
 */

import { Request, Response, NextFunction } from "express";
import { swipeService } from "../services/swipe.service.js";
import { z } from "zod";
import { BadRequestError } from "../utils/errors.js";

// Validation schemas
const startSessionSchema = z.object({
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
});

const swipeSchema = z.object({
    restaurantId: z.string().uuid(),
    action: z.enum(["like", "dislike", "super_like"]),
});

const completeSessionSchema = z.object({
    restaurantId: z.string().uuid().optional(),
});

const markVisitedSchema = z.object({
    rating: z.number().min(1).max(5).optional(),
    review: z.string().max(1000).optional(),
});

/**
 * Start a new swipe session
 * POST /api/swipe/sessions
 */
export async function startSession(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validated = startSessionSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const userId = req.user!.id;
        const session = await swipeService.startSession({
            userId,
            latitude: validated.data.latitude,
            longitude: validated.data.longitude,
            preferences: validated.data.preferences,
        });

        res.status(201).json({
            success: true,
            message: "Session started",
            data: session,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get active session
 * GET /api/swipe/sessions/active
 */
export async function getActiveSession(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const session = await swipeService.getActiveSession(userId);

        res.json({
            success: true,
            data: session,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Record a swipe
 * POST /api/swipe/sessions/:id/swipe
 */
export async function swipe(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = swipeSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const result = await swipeService.swipe({
            sessionId: id,
            userId,
            restaurantId: validated.data.restaurantId,
            action: validated.data.action,
        });

        res.json({
            success: true,
            message: result.isMatch ? "It's a match!" : "Swipe recorded",
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Complete session and pick a match
 * POST /api/swipe/sessions/:id/complete
 */
export async function completeSession(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = completeSessionSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const session = await swipeService.completeSession(
            id,
            userId,
            validated.data.restaurantId
        );

        res.json({
            success: true,
            message: "Session completed",
            data: session,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Cancel/abandon session
 * DELETE /api/swipe/sessions/:id
 */
export async function cancelSession(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        await swipeService.cancelSession(id, userId);

        res.json({
            success: true,
            message: "Session cancelled",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get swipe history
 * GET /api/swipe/history
 */
export async function getHistory(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const limit = req.query.limit
            ? parseInt(req.query.limit as string)
            : 20;

        const sessions = await swipeService.getHistory(userId, limit);

        res.json({
            success: true,
            data: sessions,
            count: sessions.length,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get user's matches
 * GET /api/swipe/matches
 */
export async function getMatches(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const limit = req.query.limit
            ? parseInt(req.query.limit as string)
            : 20;

        const matchesList = await swipeService.getMatches(userId, limit);

        res.json({
            success: true,
            data: matchesList,
            count: matchesList.length,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Mark a match as visited
 * PATCH /api/swipe/matches/:id/visited
 */
export async function markVisited(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = markVisitedSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const match = await swipeService.markVisited(
            id,
            userId,
            validated.data.rating,
            validated.data.review
        );

        res.json({
            success: true,
            message: "Match marked as visited",
            data: match,
        });
    } catch (error) {
        next(error);
    }
}
