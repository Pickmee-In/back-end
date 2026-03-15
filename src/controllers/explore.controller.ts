import { NextFunction, Request, Response } from "express";

import { exploreService } from "../services/explore.service.js";
import { BadRequestError } from "../utils/errors.js";

function parseNumber(value: unknown): number | undefined {
    if (value == null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getExploreItems(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user?.id;
        if (!userId) throw new BadRequestError("Unauthorized context");

        const result = await exploreService.getExploreItems(userId, {
            category: (req.query.category as string) || undefined,
            priceFilter: (req.query.priceFilter as "free" | "paid" | "all") ||
                undefined,
            sortBy: (req.query.sortBy as string) || undefined,
            latitude: parseNumber(req.query.latitude),
            longitude: parseNumber(req.query.longitude),
            maxDistanceKm: parseNumber(req.query.maxDistanceKm),
            includeSwiped: req.query.includeSwiped === "true",
            listingType: (req.query.listingType as "swap" | "donate" | "thrift") ||
                undefined,
            limit: parseNumber(req.query.limit),
            offset: parseNumber(req.query.offset),
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function swipeItem(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user?.id;
        if (!userId) throw new BadRequestError("Unauthorized context");

        const { itemId, action } = req.body as {
            itemId?: string;
            action?: "pick" | "skip";
        };

        if (!itemId) {
            throw new BadRequestError("itemId is required");
        }

        if (action !== "pick" && action !== "skip") {
            throw new BadRequestError("action must be pick or skip");
        }

        const result = await exploreService.swipeItem(userId, itemId, action);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function getFavorites(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user?.id;
        if (!userId) throw new BadRequestError("Unauthorized context");

        const result = await exploreService.getFavorites(userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

export async function removeFavorite(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user?.id;
        if (!userId) throw new BadRequestError("Unauthorized context");

        const itemId = req.params.itemId;
        if (!itemId) throw new BadRequestError("itemId is required");

        const result = await exploreService.unsaveFavorite(userId, itemId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}
