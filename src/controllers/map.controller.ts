import type { Request, Response } from "express";

import { mapService } from "../services/map.service.js";

/**
 * GET /api/map/nearby
 *
 * Query params:
 *   latitude        number   (optional) caller's latitude
 *   longitude       number   (optional) caller's longitude
 *   maxDistanceKm   number   (optional) radius filter in km
 *   listingType     string   (optional) "swap" | "donate" | "thrift"
 *   q               string   (optional) free-text search (title / location)
 *   limit           number   (optional, default 200, max 500)
 */
export async function getNearbyItems(
    req: Request,
    res: Response
): Promise<void> {
    const userId = req.user!.id;
    const { latitude, longitude, maxDistanceKm, listingType, q, limit } =
        req.query;

    const result = await mapService.getNearbyItems(userId, {
        latitude: latitude ? parseFloat(latitude as string) : undefined,
        longitude: longitude ? parseFloat(longitude as string) : undefined,
        maxDistanceKm: maxDistanceKm
            ? parseFloat(maxDistanceKm as string)
            : undefined,
        listingType: listingType as
            | "swap"
            | "donate"
            | "thrift"
            | undefined,
        q: q ? (q as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(result);
}

/**
 * GET /api/map/items/:id
 *
 * Returns a single clothing item (with coordinates) for the map detail card.
 */
export async function getItemById(
    req: Request,
    res: Response
): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const item = await mapService.getItemById(userId, id);

    if (!item) {
        res.status(404).json({ message: "Item not found or has no location" });
        return;
    }

    res.json({ item });
}
