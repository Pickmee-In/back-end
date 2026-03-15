import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { config } from "../config/index.js";
import {
    clothingItemPhotos,
    clothingItems,
    db,
    swipes,
} from "../db/index.js";
import { NotFoundError } from "../utils/errors.js";

type SwipeAction = "pick" | "skip";

function toAbsoluteUrl(relPath: string | null | undefined): string | null {
    if (!relPath) return null;
    if (relPath.startsWith("http://") || relPath.startsWith("https://")) return relPath;
    return `${config.appUrl}${relPath}`;
}

export interface ExploreQuery {
    category?: string;
    priceFilter?: "free" | "paid" | "all";
    sortBy?: string;
    latitude?: number;
    longitude?: number;
    maxDistanceKm?: number;
    includeSwiped?: boolean;
    listingType?: "swap" | "donate" | "thrift";
    limit?: number;
    offset?: number;
}

interface ExploreItemDto {
    id: string;
    name: string;
    category: string;
    condition: string;
    distance: string;
    imageUrl: string;
    isNewDrop: boolean;

    // additional fields for future frontend extension
    listingType: string;
    size: string;
    isFavorite: boolean;
    price: number | null;
    locationLabel: string | null;
    createdAt: Date;
}

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
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatDistance(km?: number): string {
    if (km == null || Number.isNaN(km)) return "Unknown distance";
    return `${km.toFixed(1)} km away`;
}

function mapCategoryForFrontend(value: string): string {
    if (!value) return "Other";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function mapConditionForFrontend(value: string): string {
    switch (value) {
        case "like_new":
            return "Like New";
        case "excellent":
            return "Excellent Condition";
        case "good":
            return "Good Condition";
        case "fair":
            return "Fair Condition";
        default:
            return value;
    }
}

function conditionRank(value: string): number {
    switch (value) {
        case "like_new":
            return 4;
        case "excellent":
            return 3;
        case "good":
            return 2;
        case "fair":
            return 1;
        default:
            return 0;
    }
}

export class ExploreService {
    async getExploreItems(userId: string, query: ExploreQuery) {
        const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
        const offset = Math.max(query.offset ?? 0, 0);

        const whereConditions = [
            eq(clothingItems.status, "active"),
            ne(clothingItems.ownerId, userId),
        ];

        if (query.category && query.category.toLowerCase() !== "all") {
            whereConditions.push(
                eq(
                    clothingItems.category,
                    query.category.toLowerCase() as (typeof clothingItems.category.enumValues)[number]
                )
            );
        }

        if (query.priceFilter === "free") {
            whereConditions.push(eq(clothingItems.isFree, true));
        }

        if (query.priceFilter === "paid") {
            whereConditions.push(eq(clothingItems.isFree, false));
        }

        if (query.listingType) {
            whereConditions.push(eq(clothingItems.listingType, query.listingType));
        }

        const rows = await db
            .select()
            .from(clothingItems)
            .where(and(...whereConditions))
            .orderBy(desc(clothingItems.createdAt))
            .limit(limit)
            .offset(offset);

        if (rows.length === 0) {
            return {
                items: [] as ExploreItemDto[],
                pagination: { limit, offset, count: 0 },
            };
        }

        const itemIds = rows.map((r) => r.id);

        const photos = await db
            .select()
            .from(clothingItemPhotos)
            .where(inArray(clothingItemPhotos.itemId, itemIds));

        const swipedRows = await db
            .select()
            .from(swipes)
            .where(
                and(
                    eq(swipes.userId, userId),
                    inArray(swipes.itemId, itemIds)
                )
            );

        const swipeMap = new Map(swipedRows.map((s) => [s.itemId, s.action]));

        const primaryPhotoMap = new Map<string, string>();
        for (const p of photos) {
            const existing = primaryPhotoMap.get(p.itemId);
            if (!existing || p.isPrimary) {
                primaryPhotoMap.set(p.itemId, p.url);
            }
        }

        const mapped = rows
            .map((item) => {
                const itemLat = item.latitude ? parseFloat(item.latitude) : null;
                const itemLng = item.longitude ? parseFloat(item.longitude) : null;

                let distanceKm: number | undefined;
                if (
                    query.latitude != null &&
                    query.longitude != null &&
                    itemLat != null &&
                    itemLng != null
                ) {
                    distanceKm = haversineKm(
                        query.latitude,
                        query.longitude,
                        itemLat,
                        itemLng
                    );
                }

                return {
                    id: item.id,
                    name: item.title,
                    category: mapCategoryForFrontend(item.category),
                    condition: mapConditionForFrontend(item.condition),
                    distance: formatDistance(distanceKm),
                    imageUrl:
                        toAbsoluteUrl(primaryPhotoMap.get(item.id)) ??
                        "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200",
                    isNewDrop:
                        Date.now() - new Date(item.createdAt).getTime() <=
                        1000 * 60 * 60 * 24 * 3,
                    listingType: item.listingType,
                    size: item.size,
                    isFavorite: swipeMap.get(item.id) === "pick",
                    price: item.price ? parseFloat(item.price) : null,
                    locationLabel: item.locationLabel,
                    createdAt: item.createdAt,
                    _distanceKm: distanceKm,
                    _conditionRank: conditionRank(item.condition),
                    _swipeAction: swipeMap.get(item.id),
                };
            })
            .filter((item) => {
                if (query.maxDistanceKm != null) {
                    if (item._distanceKm == null) return false;
                    if (item._distanceKm > query.maxDistanceKm) return false;
                }

                if (!query.includeSwiped && item._swipeAction) {
                    return false;
                }

                return true;
            });

        const sortBy = (query.sortBy ?? "newest").toLowerCase();
        const sorted = [...mapped].sort((a, b) => {
            if (sortBy === "closest" || sortBy === "terdekat") {
                return (a._distanceKm ?? Number.MAX_SAFE_INTEGER) -
                    (b._distanceKm ?? Number.MAX_SAFE_INTEGER);
            }

            if (sortBy === "price: low to high" || sortBy === "price_asc") {
                return (a.price ?? Number.MAX_SAFE_INTEGER) -
                    (b.price ?? Number.MAX_SAFE_INTEGER);
            }

            if (sortBy === "price: high to low" || sortBy === "price_desc") {
                return (b.price ?? -1) - (a.price ?? -1);
            }

            if (sortBy === "condition") {
                return b._conditionRank - a._conditionRank;
            }

            // newest fallback
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        const items = sorted.map(({ _distanceKm, _conditionRank, _swipeAction, ...rest }) => rest);

        return {
            items,
            pagination: {
                limit,
                offset,
                count: items.length,
            },
        };
    }

    async swipeItem(userId: string, itemId: string, action: SwipeAction) {
        const [item] = await db
            .select({ id: clothingItems.id })
            .from(clothingItems)
            .where(eq(clothingItems.id, itemId))
            .limit(1);

        if (!item) {
            throw new NotFoundError("Item not found");
        }

        const [existing] = await db
            .select()
            .from(swipes)
            .where(and(eq(swipes.userId, userId), eq(swipes.itemId, itemId)))
            .limit(1);

        if (existing) {
            const [updated] = await db
                .update(swipes)
                .set({ action, createdAt: new Date() })
                .where(eq(swipes.id, existing.id))
                .returning();

            return {
                swipe: updated,
                isFavorite: updated.action === "pick",
                skipped: updated.action === "skip",
            };
        }

        const [created] = await db
            .insert(swipes)
            .values({
                userId,
                itemId,
                action,
            })
            .returning();

        return {
            swipe: created,
            isFavorite: created.action === "pick",
            skipped: created.action === "skip",
        };
    }

    async getFavorites(userId: string) {
        const rows = await db
            .select({
                item: clothingItems,
            })
            .from(swipes)
            .innerJoin(clothingItems, eq(swipes.itemId, clothingItems.id))
            .where(and(eq(swipes.userId, userId), eq(swipes.action, "pick")))
            .orderBy(desc(swipes.createdAt));

        if (rows.length === 0) {
            return { items: [] };
        }

        const itemIds = rows.map((r) => r.item.id);
        const photos = await db
            .select()
            .from(clothingItemPhotos)
            .where(inArray(clothingItemPhotos.itemId, itemIds));

        const primaryPhotoMap = new Map<string, string>();
        for (const p of photos) {
            const existing = primaryPhotoMap.get(p.itemId);
            if (!existing || p.isPrimary) {
                primaryPhotoMap.set(p.itemId, p.url);
            }
        }

        return {
            items: rows.map(({ item }) => ({
                id: item.id,
                name: item.title,
                category: mapCategoryForFrontend(item.category),
                condition: mapConditionForFrontend(item.condition),
                imageUrl:
                    primaryPhotoMap.get(item.id) ??
                    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200",
                listingType: item.listingType,
                size: item.size,
                price: item.price ? parseFloat(item.price) : null,
                locationLabel: item.locationLabel,
                isFavorite: true,
                createdAt: item.createdAt,
            })),
        };
    }

    async unsaveFavorite(userId: string, itemId: string) {
        const [existing] = await db
            .select()
            .from(swipes)
            .where(and(eq(swipes.userId, userId), eq(swipes.itemId, itemId)))
            .limit(1);

        if (!existing) {
            throw new NotFoundError("Favorite not found");
        }

        await db
            .update(swipes)
            .set({ action: "skip", createdAt: new Date() })
            .where(eq(swipes.id, existing.id));

        return { success: true };
    }
}

export const exploreService = new ExploreService();
