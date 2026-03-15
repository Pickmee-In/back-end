/**
 * Swipe Service
 * Handles individual swipe sessions for finding restaurants
 */

import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
    swipeSessions,
    swipeResults,
    matches,
    restaurants,
    SwipeSession,
    NewSwipeSession,
    SwipeResult,
    Restaurant,
    UserPreferences,
} from "../db/schema.js";
import { restaurantService } from "./restaurant.service.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

interface StartSessionInput {
    userId: string;
    latitude: number;
    longitude: number;
    preferences?: UserPreferences;
}

interface SwipeInput {
    sessionId: string;
    userId: string;
    restaurantId: string;
    action: "like" | "dislike" | "super_like";
}

interface SessionWithRestaurants extends SwipeSession {
    restaurants: Restaurant[];
    swipedRestaurantIds: string[];
    matchedRestaurant?: Restaurant | null;
}

class SwipeService {
    /**
     * Start a new swipe session
     */
    async startSession(
        input: StartSessionInput
    ): Promise<SessionWithRestaurants> {
        const { userId, latitude, longitude, preferences } = input;

        // Check for existing active session
        const [activeSession] = await db
            .select()
            .from(swipeSessions)
            .where(
                and(
                    eq(swipeSessions.userId, userId),
                    isNull(swipeSessions.completedAt)
                )
            )
            .limit(1);

        if (activeSession) {
            // Return existing active session
            return this.getSessionWithRestaurants(activeSession.id, userId);
        }

        // Default preferences
        const sessionPreferences: UserPreferences = preferences || {
            categories: [],
            priceRange: { min: 0, max: 500000 },
            maxDistance: 5,
            minRating: 3.5,
        };

        // Create new session
        const [session] = await db
            .insert(swipeSessions)
            .values({
                userId,
                latitude: String(latitude),
                longitude: String(longitude),
                preferences: sessionPreferences,
            })
            .returning();

        // Fetch restaurants for this session
        const nearbyRestaurants = await restaurantService.searchWithPreferences(
            latitude,
            longitude,
            sessionPreferences,
            30
        );

        return {
            ...session,
            restaurants: nearbyRestaurants,
            swipedRestaurantIds: [],
            matchedRestaurant: null,
        };
    }

    /**
     * Get active session for user
     */
    async getActiveSession(
        userId: string
    ): Promise<SessionWithRestaurants | null> {
        const [session] = await db
            .select()
            .from(swipeSessions)
            .where(
                and(
                    eq(swipeSessions.userId, userId),
                    isNull(swipeSessions.completedAt)
                )
            )
            .limit(1);

        if (!session) {
            return null;
        }

        return this.getSessionWithRestaurants(session.id, userId);
    }

    /**
     * Get session with restaurants and swipe history
     */
    private async getSessionWithRestaurants(
        sessionId: string,
        userId: string
    ): Promise<SessionWithRestaurants> {
        const [session] = await db
            .select()
            .from(swipeSessions)
            .where(eq(swipeSessions.id, sessionId))
            .limit(1);

        if (!session) {
            throw new NotFoundError("Session not found");
        }

        // Get swiped restaurant IDs
        const swipes = await db
            .select()
            .from(swipeResults)
            .where(eq(swipeResults.sessionId, sessionId));

        const swipedRestaurantIds = swipes.map((s) => s.restaurantId);

        // Fetch restaurants for this session
        const nearbyRestaurants = await restaurantService.searchWithPreferences(
            parseFloat(session.latitude),
            parseFloat(session.longitude),
            session.preferences || {
                categories: [],
                priceRange: { min: 0, max: 500000 },
                maxDistance: 5,
                minRating: 3.5,
            },
            30
        );

        // Filter out already swiped restaurants
        const unswipedRestaurants = nearbyRestaurants.filter(
            (r) => !swipedRestaurantIds.includes(r.id)
        );

        // Get matched restaurant if exists
        let matchedRestaurant: Restaurant | null = null;
        if (session.matchedRestaurantId) {
            matchedRestaurant = await restaurantService.getById(
                session.matchedRestaurantId
            );
        }

        return {
            ...session,
            restaurants: unswipedRestaurants,
            swipedRestaurantIds,
            matchedRestaurant,
        };
    }

    /**
     * Record a swipe action
     */
    async swipe(
        input: SwipeInput
    ): Promise<{ swipe: SwipeResult; isMatch: boolean }> {
        const { sessionId, userId, restaurantId, action } = input;

        // Verify session belongs to user
        const [session] = await db
            .select()
            .from(swipeSessions)
            .where(
                and(
                    eq(swipeSessions.id, sessionId),
                    eq(swipeSessions.userId, userId)
                )
            )
            .limit(1);

        if (!session) {
            throw new NotFoundError("Session not found");
        }

        if (session.completedAt) {
            throw new BadRequestError("Session is already completed");
        }

        // Check if already swiped on this restaurant
        const [existing] = await db
            .select()
            .from(swipeResults)
            .where(
                and(
                    eq(swipeResults.sessionId, sessionId),
                    eq(swipeResults.restaurantId, restaurantId)
                )
            )
            .limit(1);

        if (existing) {
            throw new BadRequestError("Already swiped on this restaurant");
        }

        // Record the swipe
        const [swipe] = await db
            .insert(swipeResults)
            .values({
                sessionId,
                userId,
                restaurantId,
                action,
            })
            .returning();

        // Check for match conditions:
        // - Super like = instant match
        // - Like + already liked in history = potential match
        // For simplicity, super_like = instant match
        let isMatch = action === "super_like";

        // For likes, we could implement more complex matching logic
        // For now, a simple rule: if user liked 3+ restaurants, pick the first one
        if (!isMatch && action === "like") {
            const likeCount = await db
                .select()
                .from(swipeResults)
                .where(
                    and(
                        eq(swipeResults.sessionId, sessionId),
                        eq(swipeResults.action, "like")
                    )
                );

            // After 3 likes without super_like, suggest completing
            if (likeCount.length >= 3) {
                // Could auto-complete here or just notify frontend
            }
        }

        if (isMatch) {
            // Update session with match
            await db
                .update(swipeSessions)
                .set({
                    matchedRestaurantId: restaurantId,
                    completedAt: new Date(),
                })
                .where(eq(swipeSessions.id, sessionId));

            // Create match record
            await db.insert(matches).values({
                userId,
                restaurantId,
                score: action === "super_like" ? 100 : 50,
            });
        }

        return { swipe, isMatch };
    }

    /**
     * Complete session and pick a match
     */
    async completeSession(
        sessionId: string,
        userId: string,
        restaurantId?: string
    ): Promise<SessionWithRestaurants> {
        const [session] = await db
            .select()
            .from(swipeSessions)
            .where(
                and(
                    eq(swipeSessions.id, sessionId),
                    eq(swipeSessions.userId, userId)
                )
            )
            .limit(1);

        if (!session) {
            throw new NotFoundError("Session not found");
        }

        if (session.completedAt) {
            throw new BadRequestError("Session is already completed");
        }

        // If no restaurant specified, pick the best one from likes
        let matchedRestaurantId = restaurantId;

        if (!matchedRestaurantId) {
            // Get all likes from this session, prioritize super_likes
            const likes = await db
                .select()
                .from(swipeResults)
                .innerJoin(
                    restaurants,
                    eq(swipeResults.restaurantId, restaurants.id)
                )
                .where(
                    and(
                        eq(swipeResults.sessionId, sessionId),
                        eq(swipeResults.action, "like")
                    )
                )
                .limit(1);

            const superLikes = await db
                .select()
                .from(swipeResults)
                .where(
                    and(
                        eq(swipeResults.sessionId, sessionId),
                        eq(swipeResults.action, "super_like")
                    )
                )
                .limit(1);

            if (superLikes.length > 0) {
                matchedRestaurantId = superLikes[0].restaurantId;
            } else if (likes.length > 0) {
                matchedRestaurantId = likes[0].swipe_results.restaurantId;
            }
        }

        if (!matchedRestaurantId) {
            throw new BadRequestError("No liked restaurants to match with");
        }

        // Update session
        await db
            .update(swipeSessions)
            .set({
                matchedRestaurantId,
                completedAt: new Date(),
            })
            .where(eq(swipeSessions.id, sessionId));

        // Create match record
        await db.insert(matches).values({
            userId,
            restaurantId: matchedRestaurantId,
            score: 50,
        });

        return this.getSessionWithRestaurants(sessionId, userId);
    }

    /**
     * Cancel/abandon session
     */
    async cancelSession(sessionId: string, userId: string): Promise<void> {
        const [session] = await db
            .select()
            .from(swipeSessions)
            .where(
                and(
                    eq(swipeSessions.id, sessionId),
                    eq(swipeSessions.userId, userId)
                )
            )
            .limit(1);

        if (!session) {
            throw new NotFoundError("Session not found");
        }

        // Just mark as completed without a match
        await db
            .update(swipeSessions)
            .set({
                completedAt: new Date(),
            })
            .where(eq(swipeSessions.id, sessionId));
    }

    /**
     * Get user's swipe history
     */
    async getHistory(
        userId: string,
        limit: number = 20
    ): Promise<SwipeSession[]> {
        const sessions = await db
            .select()
            .from(swipeSessions)
            .where(eq(swipeSessions.userId, userId))
            .orderBy(desc(swipeSessions.createdAt))
            .limit(limit);

        return sessions;
    }

    /**
     * Get user's matches
     */
    async getMatches(userId: string, limit: number = 20): Promise<any[]> {
        const result = await db
            .select({
                match: matches,
                restaurant: restaurants,
            })
            .from(matches)
            .innerJoin(restaurants, eq(matches.restaurantId, restaurants.id))
            .where(eq(matches.userId, userId))
            .orderBy(desc(matches.createdAt))
            .limit(limit);

        return result.map((row) => ({
            ...row.match,
            restaurant: row.restaurant,
        }));
    }

    /**
     * Mark a match as visited
     */
    async markVisited(
        matchId: string,
        userId: string,
        rating?: number,
        review?: string
    ): Promise<typeof matches.$inferSelect> {
        const [match] = await db
            .select()
            .from(matches)
            .where(and(eq(matches.id, matchId), eq(matches.userId, userId)))
            .limit(1);

        if (!match) {
            throw new NotFoundError("Match not found");
        }

        const [updated] = await db
            .update(matches)
            .set({
                visited: true,
                visitedAt: new Date(),
                userRating: rating,
                userReview: review,
            })
            .where(eq(matches.id, matchId))
            .returning();

        return updated;
    }
}

export const swipeService = new SwipeService();
