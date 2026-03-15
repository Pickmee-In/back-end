import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";

import { config } from "../config/index.js";
import {
    clothingItemPhotos,
    clothingItems,
    db,
    swipes,
} from "../db/index.js";

export interface MapQuery {
    latitude?: number;
    longitude?: number;
    maxDistanceKm?: number;
    listingType?: "swap" | "donate" | "thrift";
    /** free-text search on title and locationLabel */
    q?: string;
    limit?: number;
}

export interface MapItemDto {
    id: string;
    title: string;
    latitude: number;
    longitude: number;
    imageUrl: string;
    listingType: string;
    isFavorite: boolean;
    distance: string;
    distanceKm: number | null;
    locationLabel: string | null;
    category: string;
    condition: string;
    size: string;
    price: number | null;
    isNewDrop: boolean;
}

function toAbsoluteUrl(relPath: string | null | undefined): string | null {
    if (!relPath) return null;
    if (relPath.startsWith("http://") || relPath.startsWith("https://")) return relPath;
    return `${config.appUrl}${relPath}`;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number | null): string {
    if (km == null || Number.isNaN(km)) return "";
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    return `${km.toFixed(1)} km`;
}

function categoryLabel(v: string): string {
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : "Other";
}

function conditionLabel(v: string): string {
    const map: Record<string, string> = {
        like_new: "Like New",
        excellent: "Excellent",
        good: "Good",
        fair: "Fair",
    };
    return map[v] ?? v;
}

// ──────────────────────────────────────────────────────────────────
// MapService
// ──────────────────────────────────────────────────────────────────

export class MapService {
    /**
     * Return all active clothing items that have coordinates, with optional
     * search/filter/distance constraints.  Results are sorted nearest-first
     * when the caller provides lat/lng.
     */
    async getNearbyItems(
        userId: string,
        query: MapQuery
    ): Promise<{ items: MapItemDto[] }> {
        const limit = Math.min(query.limit ?? 200, 500);

        const conditions = [
            eq(clothingItems.status, "active"),
            ne(clothingItems.ownerId, userId),
        ];

        if (query.listingType) {
            conditions.push(
                eq(clothingItems.listingType, query.listingType)
            );
        }

        if (query.q && query.q.trim().length > 0) {
            const term = `%${query.q.trim()}%`;
            const searchCondition = or(
                ilike(clothingItems.title, term),
                ilike(clothingItems.locationLabel, term)
            );
            if (searchCondition) conditions.push(searchCondition);
        }

        const rows = await db
            .select()
            .from(clothingItems)
            .where(and(...conditions))
            .limit(limit);

        // Only map items with valid coordinates
        const withCoords = rows.filter(
            (r) => r.latitude != null && r.longitude != null
        );

        if (withCoords.length === 0) return { items: [] };

        const itemIds = withCoords.map((r) => r.id);

        const [photos, swipeRows] = await Promise.all([
            db
                .select()
                .from(clothingItemPhotos)
                .where(inArray(clothingItemPhotos.itemId, itemIds)),
            db
                .select()
                .from(swipes)
                .where(
                    and(
                        eq(swipes.userId, userId),
                        inArray(swipes.itemId, itemIds)
                    )
                ),
        ]);

        const photoMap = new Map<string, string>();
        for (const p of photos) {
            if (!photoMap.has(p.itemId) || p.isPrimary) {
                photoMap.set(p.itemId, p.url);
            }
        }

        const swipeMap = new Map(swipeRows.map((s) => [s.itemId, s.action]));

        const FALLBACK_IMG =
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800";

        const THREE_DAYS_MS = 1000 * 60 * 60 * 24 * 3;

        const items: MapItemDto[] = withCoords
            .map((item) => {
                const lat = parseFloat(item.latitude!);
                const lng = parseFloat(item.longitude!);

                const distanceKm =
                    query.latitude != null && query.longitude != null
                        ? haversineKm(query.latitude, query.longitude, lat, lng)
                        : null;

                return {
                    id: item.id,
                    title: item.title,
                    latitude: lat,
                    longitude: lng,
                    imageUrl: toAbsoluteUrl(photoMap.get(item.id)) ?? FALLBACK_IMG,
                    listingType: item.listingType,
                    isFavorite: swipeMap.get(item.id) === "pick",
                    distance: formatDistance(distanceKm),
                    distanceKm,
                    locationLabel: item.locationLabel,
                    category: categoryLabel(item.category),
                    condition: conditionLabel(item.condition),
                    size: item.size,
                    price: item.price ? parseFloat(item.price) : null,
                    isNewDrop:
                        Date.now() - new Date(item.createdAt).getTime() <=
                        THREE_DAYS_MS,
                };
            })
            .filter((item) => {
                if (
                    query.maxDistanceKm != null &&
                    item.distanceKm != null
                ) {
                    return item.distanceKm <= query.maxDistanceKm;
                }
                return true;
            })
            .sort(
                (a, b) =>
                    (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
            );

        return { items };
    }

    /**
     * Return a single active item by id (must have coordinates).
     */
    async getItemById(
        userId: string,
        itemId: string
    ): Promise<MapItemDto | null> {
        const [item] = await db
            .select()
            .from(clothingItems)
            .where(
                and(
                    eq(clothingItems.id, itemId),
                    eq(clothingItems.status, "active")
                )
            )
            .limit(1);

        if (!item || !item.latitude || !item.longitude) return null;

        const [photos, swipeRows] = await Promise.all([
            db
                .select()
                .from(clothingItemPhotos)
                .where(eq(clothingItemPhotos.itemId, itemId)),
            db
                .select()
                .from(swipes)
                .where(
                    and(
                        eq(swipes.userId, userId),
                        eq(swipes.itemId, itemId)
                    )
                ),
        ]);

        const imageUrl =
            photos.find((p) => p.isPrimary)?.url ??
            photos[0]?.url ??
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800";

        return {
            id: item.id,
            title: item.title,
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            imageUrl,
            listingType: item.listingType,
            isFavorite: swipeRows[0]?.action === "pick",
            distance: "",
            distanceKm: null,
            locationLabel: item.locationLabel,
            category: categoryLabel(item.category),
            condition: conditionLabel(item.condition),
            size: item.size,
            price: item.price ? parseFloat(item.price) : null,
            isNewDrop:
                Date.now() - new Date(item.createdAt).getTime() <=
                1000 * 60 * 60 * 24 * 3,
        };
    }
}

export const mapService = new MapService();
