import { and, eq, inArray, or } from "drizzle-orm";

import {
    clothingItems,
    conversationParticipants,
    db,
    matches,
    messages,
    userImpactStats,
} from "../db/index.js";

class ProfileService {
    async getProfileStats(userId: string) {
        const items = await db
            .select({ id: clothingItems.id })
            .from(clothingItems)
            .where(and(eq(clothingItems.ownerId, userId), eq(clothingItems.status, "active")));

        const completedMatches = await db
            .select({ id: matches.id })
            .from(matches)
            .where(
                and(
                    eq(matches.status, "completed"),
                    or(eq(matches.ownerId, userId), eq(matches.pickerId, userId))
                )
            );

        const [impact] = await db
            .select()
            .from(userImpactStats)
            .where(eq(userImpactStats.userId, userId))
            .limit(1);

        const myConversationParticipants = await db
            .select()
            .from(conversationParticipants)
            .where(eq(conversationParticipants.userId, userId));
        const conversationIds = myConversationParticipants.map((row) => row.conversationId);

        let unreadMessages = 0;
        if (conversationIds.length > 0) {
            const rows = await db
                .select()
                .from(messages)
                .where(inArray(messages.conversationId, conversationIds));

            const lastReadMap = new Map(
                myConversationParticipants.map((row) => [row.conversationId, row.lastReadAt])
            );

            unreadMessages = rows.filter((row) => {
                if (row.senderId === userId) return false;
                const lastReadAt = lastReadMap.get(row.conversationId);
                if (!lastReadAt) return true;
                return new Date(row.createdAt) > new Date(lastReadAt);
            }).length;
        }

        return {
            activeItems: items.length,
            completedMatches: completedMatches.length,
            carbonSavedKg: Number(impact?.co2SavedKg ?? 0),
            ecoPoints: impact?.ecoPoints ?? 0,
            level: impact?.level ?? "Eco Beginner",
            progressValue: Math.max(
                0.05,
                Math.min(1, ((impact?.ecoPoints ?? 0) % 1000) / 1000)
            ),
            unreadMessages,
            totalConversations: conversationIds.length,
            itemsReused: impact?.itemsReused ?? 0,
        };
    }
}

export const profileService = new ProfileService();
