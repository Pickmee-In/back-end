/**
 * Group Controller
 * Handles HTTP request/response for group endpoints
 */

import { Request, Response, NextFunction } from "express";
import { groupService } from "../services/group.service.js";
import { z } from "zod";
import { BadRequestError } from "../utils/errors.js";

// Validation schemas
const createGroupSchema = z.object({
    name: z.string().min(1).max(100),
    maxMembers: z.number().min(2).max(20).optional(),
    votingDuration: z.number().min(60).max(3600).optional(), // 1 min to 1 hour
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    maxDistance: z.number().min(1).max(50).optional(),
    preferences: z
        .object({
            categories: z.array(z.string()).default([]),
            priceRange: z
                .object({
                    min: z.number().default(0),
                    max: z.number().default(500000),
                })
                .default({ min: 0, max: 500000 }),
            minRating: z.number().min(0).max(5).default(3.5),
        })
        .optional(),
});

const updateLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

const updatePreferencesSchema = z.object({
    categories: z.array(z.string()).default([]),
    priceRange: z
        .object({
            min: z.number().default(0),
            max: z.number().default(500000),
        })
        .default({ min: 0, max: 500000 }),
    minRating: z.number().min(0).max(5).default(3.5),
});

const voteSchema = z.object({
    restaurantId: z.string().uuid(),
    action: z.enum(["like", "dislike", "super_like"]),
});

const sendMessageSchema = z.object({
    message: z.string().min(1).max(1000),
});

/**
 * Create a new group
 * POST /api/groups
 */
export async function createGroup(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validated = createGroupSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const userId = req.user!.id;
        const group = await groupService.create({
            ...validated.data,
            ownerId: userId,
        });

        res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get group by ID
 * GET /api/groups/:id
 */
export async function getGroup(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const group = await groupService.getById(id);

        res.json({
            success: true,
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get group by code
 * GET /api/groups/code/:code
 */
export async function getGroupByCode(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { code } = req.params;
        const group = await groupService.getByCode(code);

        res.json({
            success: true,
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Join a group by code
 * POST /api/groups/join/:code
 */
export async function joinGroup(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { code } = req.params;
        const userId = req.user!.id;

        const group = await groupService.join(userId, code);

        res.json({
            success: true,
            message: "Joined group successfully",
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Leave a group
 * POST /api/groups/:id/leave
 */
export async function leaveGroup(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        await groupService.leave(userId, id);

        res.json({
            success: true,
            message: "Left group successfully",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Set ready status
 * PATCH /api/groups/:id/ready
 */
export async function setReady(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const { isReady } = req.body;

        const member = await groupService.setReady(
            userId,
            id,
            isReady === true
        );

        res.json({
            success: true,
            message: isReady ? "Marked as ready" : "Marked as not ready",
            data: member,
        });
    } catch (error) {
        next(error);
    }
}

// Schema for member preferences
const memberPreferencesSchema = z.object({
    categories: z.array(z.string()).default([]),
    priceRange: z
        .object({
            min: z.number().default(0),
            max: z.number().default(500000),
        })
        .default({ min: 0, max: 500000 }),
    maxDistance: z.number().min(1).max(50).default(5),
    minRating: z.number().min(0).max(5).default(3.5),
});

/**
 * Submit member preferences and set as ready
 * POST /api/groups/:id/member-preferences
 */
export async function submitMemberPreferences(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = memberPreferencesSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid preferences: " + validated.error.message
            );
        }

        const member = await groupService.submitMemberPreferences(
            userId,
            id,
            validated.data
        );

        res.json({
            success: true,
            message: "Preferences saved and marked as ready",
            data: member,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Start voting
 * POST /api/groups/:id/start-voting
 */
export async function startVoting(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const group = await groupService.startVoting(userId, id);

        res.json({
            success: true,
            message: "Voting started",
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get voting restaurants
 * GET /api/groups/:id/restaurants
 */
export async function getVotingRestaurants(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const restaurants = await groupService.getVotingRestaurants(id);

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
 * Submit a vote
 * POST /api/groups/:id/vote
 */
export async function submitVote(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = voteSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        await groupService.vote({
            groupId: id,
            userId,
            restaurantId: validated.data.restaurantId,
            action: validated.data.action,
        });

        res.json({
            success: true,
            message: "Vote submitted",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Complete voting and get results
 * POST /api/groups/:id/complete
 */
export async function completeVoting(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const results = await groupService.completeVoting(id);

        res.json({
            success: true,
            message: "Voting completed",
            data: results,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Force complete voting (owner only)
 * POST /api/groups/:id/force-complete
 */
export async function forceCompleteVoting(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const results = await groupService.forceCompleteVoting(userId, id);

        res.json({
            success: true,
            message: "Voting force completed by owner",
            data: results,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get voting progress
 * GET /api/groups/:id/voting-progress
 */
export async function getVotingProgress(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const progress = await groupService.getVotingProgress(id);

        res.json({
            success: true,
            data: progress,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Check and auto-complete expired voting
 * POST /api/groups/:id/check-complete
 */
export async function checkAndAutoComplete(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const result = await groupService.checkAndAutoComplete(id);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get matched restaurant for completed group
 * GET /api/groups/:id/match
 */
export async function getMatchedRestaurant(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const restaurant = await groupService.getMatchedRestaurant(id);

        res.json({
            success: true,
            data: restaurant,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update group location
 * PATCH /api/groups/:id/location
 */
export async function updateLocation(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = updateLocationSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const group = await groupService.updateLocation(
            userId,
            id,
            validated.data.latitude,
            validated.data.longitude
        );

        res.json({
            success: true,
            message: "Location updated",
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Update group preferences
 * PATCH /api/groups/:id/preferences
 */
export async function updatePreferences(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = updatePreferencesSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const group = await groupService.updatePreferences(
            userId,
            id,
            validated.data
        );

        res.json({
            success: true,
            message: "Preferences updated",
            data: group,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Delete a group
 * DELETE /api/groups/:id
 */
export async function deleteGroup(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        await groupService.delete(userId, id);

        res.json({
            success: true,
            message: "Group deleted",
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get user's groups
 * GET /api/groups
 */
export async function getUserGroups(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const groups = await groupService.getUserGroups(userId);

        res.json({
            success: true,
            data: groups,
            count: groups.length,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Send chat message
 * POST /api/groups/:id/messages
 */
export async function sendMessage(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const validated = sendMessageSchema.safeParse(req.body);
        if (!validated.success) {
            throw new BadRequestError(
                "Invalid request body: " + validated.error.message
            );
        }

        const message = await groupService.sendMessage(
            id,
            userId,
            validated.data.message
        );

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Get chat messages
 * GET /api/groups/:id/messages
 */
export async function getMessages(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;
        const limit = req.query.limit
            ? parseInt(req.query.limit as string)
            : 50;

        const messages = await groupService.getMessages(id, limit);

        res.json({
            success: true,
            data: messages,
            count: messages.length,
        });
    } catch (error) {
        next(error);
    }
}
