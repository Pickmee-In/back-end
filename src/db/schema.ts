/**
 * Database Schema using Drizzle ORM
 * Domain: PickMea (Circular Fashion Platform)
 */

import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    jsonb,
    index,
    integer,
    decimal,
    pgEnum,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const clothingCategoryEnum = pgEnum("clothing_category", [
    "jacket",
    "shirt",
    "sweater",
    "dress",
    "pants",
    "skirt",
    "shoes",
    "accessories",
    "other",
]);

export const clothingConditionEnum = pgEnum("clothing_condition", [
    "like_new",
    "excellent",
    "good",
    "fair",
]);

export const listingTypeEnum = pgEnum("listing_type", [
    "swap",
    "donate",
    "thrift",
]);

export const listingStatusEnum = pgEnum("listing_status", [
    "draft",
    "active",
    "reserved",
    "matched",
    "completed",
    "archived",
    "removed",
]);

export const swipeActionEnum = pgEnum("swipe_action", ["pick", "skip"]);

export const sentimentalLevelEnum = pgEnum("sentimental_level", [
    "low",
    "medium",
    "high",
]);

export const matchStatusEnum = pgEnum("match_status", [
    "pending",
    "chatting",
    "arranged",
    "completed",
    "cancelled",
    "expired",
]);

export const participantRoleEnum = pgEnum("participant_role", [
    "owner",
    "picker",
    "admin",
]);

export const messageTypeEnum = pgEnum("message_type", [
    "text",
    "system",
    "offer",
    "shipping",
    "meetup",
]);

export const dropPointTypeEnum = pgEnum("drop_point_type", [
    "thrift_store",
    "donation_center",
    "charity_dropbox",
    "recycle_center",
]);

export const serviceTypeEnum = pgEnum("service_type", [
    "swap",
    "donate",
    "thrift",
    "recycle",
]);

export const impactEventTypeEnum = pgEnum("impact_event_type", [
    "swap_completed",
    "donation_completed",
    "thrift_completed",
    "recycle_completed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
    "match",
    "chat",
    "item",
    "impact",
    "system",
]);

// ============================================
// SHARED TYPES
// ============================================

export interface UserPreferences {
    categories: Array<
        | "jacket"
        | "shirt"
        | "sweater"
        | "dress"
        | "pants"
        | "skirt"
        | "shoes"
        | "accessories"
        | "other"
    >;
    sizes: string[];
    maxDistanceKm: number;
    listingTypes: Array<"swap" | "donate" | "thrift">;
}

export interface DropPointHours {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
    timezone?: string;
}

// ============================================
// USERS & AUTH TABLES
// ============================================

export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        email: varchar("email", { length: 255 }).unique().notNull(),
        passwordHash: varchar("password_hash", { length: 255 }),
        name: varchar("name", { length: 255 }).notNull(),
        username: varchar("username", { length: 50 }).unique(),
        phone: varchar("phone", { length: 20 }),
        avatar: text("avatar"),
        bio: text("bio"),

        // OAuth fields
        googleId: varchar("google_id", { length: 255 }).unique(),
        appleId: varchar("apple_id", { length: 255 }).unique(),

        // Profile location
        latitude: decimal("latitude", { precision: 10, scale: 7 }),
        longitude: decimal("longitude", { precision: 10, scale: 7 }),
        locationLabel: varchar("location_label", { length: 255 }),

        // Preferences
        preferences: jsonb("preferences").$type<UserPreferences>(),

        // Profile completion
        isProfileComplete: boolean("is_profile_complete")
            .default(false)
            .notNull(),

        // Email verification
        emailVerified: boolean("email_verified").default(false).notNull(),
        emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),

        // Presence
        lastActiveAt: timestamp("last_active_at", { withTimezone: true }),

        // Timestamps
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_users_email").on(table.email),
        index("idx_users_username").on(table.username),
        index("idx_users_google_id").on(table.googleId),
        index("idx_users_apple_id").on(table.appleId),
        index("idx_users_location").on(table.latitude, table.longitude),
    ]
);

export const refreshTokens = pgTable(
    "refresh_tokens",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        token: varchar("token", { length: 500 }).unique().notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_refresh_tokens_user_id").on(table.userId),
        index("idx_refresh_tokens_token").on(table.token),
    ]
);

export const passwordResetTokens = pgTable(
    "password_reset_tokens",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        token: varchar("token", { length: 255 }).unique().notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        usedAt: timestamp("used_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [index("idx_password_reset_tokens_user_id").on(table.userId)]
);

// ============================================
// CLOTHING LISTING TABLES
// ============================================

export const clothingItems = pgTable(
    "clothing_items",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        ownerId: uuid("owner_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        title: varchar("title", { length: 200 }).notNull(),
        description: text("description"),
        category: clothingCategoryEnum("category").notNull(),
        size: varchar("size", { length: 20 }).notNull(),
        condition: clothingConditionEnum("condition").notNull(),
        brand: varchar("brand", { length: 100 }),
        color: varchar("color", { length: 50 }),
        material: varchar("material", { length: 100 }),

        listingType: listingTypeEnum("listing_type").notNull(),
        isFree: boolean("is_free").default(true).notNull(),
        price: decimal("price", { precision: 12, scale: 2 }),
        status: listingStatusEnum("status").default("active").notNull(),

        latitude: decimal("latitude", { precision: 10, scale: 7 }),
        longitude: decimal("longitude", { precision: 10, scale: 7 }),
        locationLabel: varchar("location_label", { length: 255 }),

        aiRecommendation: text("ai_recommendation"),

        publishedAt: timestamp("published_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
        index("idx_clothing_items_owner_id").on(table.ownerId),
        index("idx_clothing_items_category").on(table.category),
        index("idx_clothing_items_listing_type").on(table.listingType),
        index("idx_clothing_items_status").on(table.status),
        index("idx_clothing_items_location").on(table.latitude, table.longitude),
        index("idx_clothing_items_created_at").on(table.createdAt),
    ]
);

export const clothingItemPhotos = pgTable(
    "clothing_item_photos",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        itemId: uuid("item_id")
            .notNull()
            .references(() => clothingItems.id, { onDelete: "cascade" }),
        url: text("url").notNull(),
        sortOrder: integer("sort_order").default(0).notNull(),
        isPrimary: boolean("is_primary").default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_clothing_item_photos_item_id").on(table.itemId),
        uniqueIndex("uq_clothing_item_photos_item_order").on(
            table.itemId,
            table.sortOrder
        ),
    ]
);

export const clothingAiAnalyses = pgTable(
    "clothing_ai_analyses",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        itemId: uuid("item_id")
            .notNull()
            .references(() => clothingItems.id, { onDelete: "cascade" }),

        detectedCategory: clothingCategoryEnum("detected_category"),
        detectedColor: varchar("detected_color", { length: 50 }),
        detectedFabric: varchar("detected_fabric", { length: 100 }),
        estimatedCondition: clothingConditionEnum("estimated_condition"),
        confidence: decimal("confidence", { precision: 5, scale: 2 }),

        recommendation: text("recommendation"),
        rawResult: jsonb("raw_result"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_clothing_ai_analyses_item_id").on(table.itemId),
        index("idx_clothing_ai_analyses_created_at").on(table.createdAt),
    ]
);

export const wardrobeLoveScores = pgTable(
    "wardrobe_love_scores",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        itemId: uuid("item_id")
            .notNull()
            .references(() => clothingItems.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        wearFrequencyPerMonth: integer("wear_frequency_per_month"),
        lastWornAt: timestamp("last_worn_at", { withTimezone: true }),
        sentimentalLevel: sentimentalLevelEnum("sentimental_level"),

        score: integer("score").notNull(), // 0 - 100
        recommendation: text("recommendation"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_wardrobe_love_scores_item_id").on(table.itemId),
        index("idx_wardrobe_love_scores_user_id").on(table.userId),
    ]
);

// ============================================
// SWIPE, MATCH, AND CHAT TABLES
// ============================================

export const swipes = pgTable(
    "swipes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        itemId: uuid("item_id")
            .notNull()
            .references(() => clothingItems.id, { onDelete: "cascade" }),
        action: swipeActionEnum("action").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("uq_swipes_user_item").on(table.userId, table.itemId),
        index("idx_swipes_item_id").on(table.itemId),
        index("idx_swipes_action").on(table.action),
    ]
);

export const matches = pgTable(
    "matches",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        itemId: uuid("item_id")
            .notNull()
            .references(() => clothingItems.id, { onDelete: "cascade" }),
        ownerId: uuid("owner_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        pickerId: uuid("picker_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        status: matchStatusEnum("status").default("pending").notNull(),
        meetupLocation: varchar("meetup_location", { length: 255 }),
        shippingMethod: varchar("shipping_method", { length: 100 }),
        note: text("note"),

        matchedAt: timestamp("matched_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        arrangedAt: timestamp("arranged_at", { withTimezone: true }),
        completedAt: timestamp("completed_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("uq_matches_item_picker").on(table.itemId, table.pickerId),
        index("idx_matches_owner_id").on(table.ownerId),
        index("idx_matches_picker_id").on(table.pickerId),
        index("idx_matches_status").on(table.status),
    ]
);

export const conversations = pgTable(
    "conversations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        matchId: uuid("match_id")
            .notNull()
            .references(() => matches.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [uniqueIndex("uq_conversations_match_id").on(table.matchId)]
);

export const conversationParticipants = pgTable(
    "conversation_participants",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        role: participantRoleEnum("role").notNull(),
        lastReadAt: timestamp("last_read_at", { withTimezone: true }),
        joinedAt: timestamp("joined_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("uq_conversation_participants").on(
            table.conversationId,
            table.userId
        ),
        index("idx_conversation_participants_user_id").on(table.userId),
    ]
);

export const messages = pgTable(
    "messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        senderId: uuid("sender_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        type: messageTypeEnum("type").default("text").notNull(),
        content: text("content").notNull(),
        metadata: jsonb("metadata"),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_messages_conversation_id").on(table.conversationId),
        index("idx_messages_sender_id").on(table.senderId),
        index("idx_messages_created_at").on(table.createdAt),
    ]
);

// ============================================
// DROP POINT & MAP DISCOVERY TABLES
// ============================================

export const dropPoints = pgTable(
    "drop_points",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: varchar("name", { length: 255 }).notNull(),
        type: dropPointTypeEnum("type").notNull(),

        address: text("address").notNull(),
        latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
        longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),

        phone: varchar("phone", { length: 30 }),
        website: text("website"),

        openHours: jsonb("open_hours").$type<DropPointHours>(),
        acceptedCategories: jsonb("accepted_categories")
            .$type<string[]>()
            .default([]),

        isActive: boolean("is_active").default(true).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_drop_points_type").on(table.type),
        index("idx_drop_points_active").on(table.isActive),
        index("idx_drop_points_location").on(table.latitude, table.longitude),
    ]
);

export const dropPointServices = pgTable(
    "drop_point_services",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        dropPointId: uuid("drop_point_id")
            .notNull()
            .references(() => dropPoints.id, { onDelete: "cascade" }),
        serviceType: serviceTypeEnum("service_type").notNull(),
        description: text("description"),
        isAvailable: boolean("is_available").default(true).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("uq_drop_point_services").on(
            table.dropPointId,
            table.serviceType
        ),
        index("idx_drop_point_services_type").on(table.serviceType),
    ]
);

export const savedDropPoints = pgTable(
    "saved_drop_points",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        dropPointId: uuid("drop_point_id")
            .notNull()
            .references(() => dropPoints.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("uq_saved_drop_points").on(table.userId, table.dropPointId),
        index("idx_saved_drop_points_drop_point_id").on(table.dropPointId),
    ]
);

// ============================================
// IMPACT TRACKER TABLES
// ============================================

export const impactEvents = pgTable(
    "impact_events",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        itemId: uuid("item_id").references(() => clothingItems.id, {
            onDelete: "set null",
        }),
        matchId: uuid("match_id").references(() => matches.id, {
            onDelete: "set null",
        }),

        eventType: impactEventTypeEnum("event_type").notNull(),

        textileWasteKg: decimal("textile_waste_kg", {
            precision: 8,
            scale: 2,
        }).default("0"),
        waterSavedLiters: integer("water_saved_liters").default(0),
        co2SavedKg: decimal("co2_saved_kg", { precision: 8, scale: 2 }).default(
            "0"
        ),
        points: integer("points").default(0).notNull(),

        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_impact_events_user_id").on(table.userId),
        index("idx_impact_events_event_type").on(table.eventType),
        index("idx_impact_events_created_at").on(table.createdAt),
    ]
);

export const userImpactStats = pgTable(
    "user_impact_stats",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        itemsReused: integer("items_reused").default(0).notNull(),
        textileWasteKg: decimal("textile_waste_kg", {
            precision: 10,
            scale: 2,
        }).default("0"),
        waterSavedLiters: integer("water_saved_liters").default(0).notNull(),
        co2SavedKg: decimal("co2_saved_kg", { precision: 10, scale: 2 }).default(
            "0"
        ),
        ecoPoints: integer("eco_points").default(0).notNull(),

        level: varchar("level", { length: 50 }).default("Eco Beginner").notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [uniqueIndex("uq_user_impact_stats_user_id").on(table.userId)]
);

export const badges = pgTable(
    "badges",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code", { length: 50 }).notNull().unique(),
        name: varchar("name", { length: 100 }).notNull(),
        description: text("description"),
        requiredPoints: integer("required_points").default(0).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [index("idx_badges_required_points").on(table.requiredPoints)]
);

export const userBadges = pgTable(
    "user_badges",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        badgeId: uuid("badge_id")
            .notNull()
            .references(() => badges.id, { onDelete: "cascade" }),
        earnedAt: timestamp("earned_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex("uq_user_badges").on(table.userId, table.badgeId),
        index("idx_user_badges_badge_id").on(table.badgeId),
    ]
);

// ============================================
// NOTIFICATIONS TABLE
// ============================================

export const notifications = pgTable(
    "notifications",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),

        type: notificationTypeEnum("type").notNull(),
        title: varchar("title", { length: 150 }).notNull(),
        body: text("body").notNull(),
        data: jsonb("data"),

        isRead: boolean("is_read").default(false).notNull(),
        readAt: timestamp("read_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("idx_notifications_user_id").on(table.userId),
        index("idx_notifications_type").on(table.type),
        index("idx_notifications_is_read").on(table.isRead),
        index("idx_notifications_created_at").on(table.createdAt),
    ]
);

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
    refreshTokens: many(refreshTokens),
    passwordResetTokens: many(passwordResetTokens),

    clothingItems: many(clothingItems),
    wardrobeLoveScores: many(wardrobeLoveScores),
    swipes: many(swipes),

    ownerMatches: many(matches, { relationName: "match_owner" }),
    pickerMatches: many(matches, { relationName: "match_picker" }),

    conversationParticipants: many(conversationParticipants),
    messages: many(messages),

    savedDropPoints: many(savedDropPoints),

    impactEvents: many(impactEvents),
    impactStats: one(userImpactStats, {
        fields: [users.id],
        references: [userImpactStats.userId],
    }),

    userBadges: many(userBadges),
    notifications: many(notifications),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
    user: one(users, {
        fields: [refreshTokens.userId],
        references: [users.id],
    }),
}));

export const passwordResetTokensRelations = relations(
    passwordResetTokens,
    ({ one }) => ({
        user: one(users, {
            fields: [passwordResetTokens.userId],
            references: [users.id],
        }),
    })
);

export const clothingItemsRelations = relations(clothingItems, ({ one, many }) => ({
    owner: one(users, {
        fields: [clothingItems.ownerId],
        references: [users.id],
    }),
    photos: many(clothingItemPhotos),
    aiAnalyses: many(clothingAiAnalyses),
    loveScores: many(wardrobeLoveScores),
    swipes: many(swipes),
    matches: many(matches),
    impactEvents: many(impactEvents),
}));

export const clothingItemPhotosRelations = relations(
    clothingItemPhotos,
    ({ one }) => ({
        item: one(clothingItems, {
            fields: [clothingItemPhotos.itemId],
            references: [clothingItems.id],
        }),
    })
);

export const clothingAiAnalysesRelations = relations(
    clothingAiAnalyses,
    ({ one }) => ({
        item: one(clothingItems, {
            fields: [clothingAiAnalyses.itemId],
            references: [clothingItems.id],
        }),
    })
);

export const wardrobeLoveScoresRelations = relations(
    wardrobeLoveScores,
    ({ one }) => ({
        item: one(clothingItems, {
            fields: [wardrobeLoveScores.itemId],
            references: [clothingItems.id],
        }),
        user: one(users, {
            fields: [wardrobeLoveScores.userId],
            references: [users.id],
        }),
    })
);

export const swipesRelations = relations(swipes, ({ one }) => ({
    user: one(users, {
        fields: [swipes.userId],
        references: [users.id],
    }),
    item: one(clothingItems, {
        fields: [swipes.itemId],
        references: [clothingItems.id],
    }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
    item: one(clothingItems, {
        fields: [matches.itemId],
        references: [clothingItems.id],
    }),
    owner: one(users, {
        fields: [matches.ownerId],
        references: [users.id],
        relationName: "match_owner",
    }),
    picker: one(users, {
        fields: [matches.pickerId],
        references: [users.id],
        relationName: "match_picker",
    }),
    conversation: one(conversations, {
        fields: [matches.id],
        references: [conversations.matchId],
    }),
    impactEvents: many(impactEvents),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    match: one(matches, {
        fields: [conversations.matchId],
        references: [matches.id],
    }),
    participants: many(conversationParticipants),
    messages: many(messages),
}));

export const conversationParticipantsRelations = relations(
    conversationParticipants,
    ({ one }) => ({
        conversation: one(conversations, {
            fields: [conversationParticipants.conversationId],
            references: [conversations.id],
        }),
        user: one(users, {
            fields: [conversationParticipants.userId],
            references: [users.id],
        }),
    })
);

export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
    sender: one(users, {
        fields: [messages.senderId],
        references: [users.id],
    }),
}));

export const dropPointsRelations = relations(dropPoints, ({ many }) => ({
    services: many(dropPointServices),
    savedByUsers: many(savedDropPoints),
}));

export const dropPointServicesRelations = relations(
    dropPointServices,
    ({ one }) => ({
        dropPoint: one(dropPoints, {
            fields: [dropPointServices.dropPointId],
            references: [dropPoints.id],
        }),
    })
);

export const savedDropPointsRelations = relations(
    savedDropPoints,
    ({ one }) => ({
        user: one(users, {
            fields: [savedDropPoints.userId],
            references: [users.id],
        }),
        dropPoint: one(dropPoints, {
            fields: [savedDropPoints.dropPointId],
            references: [dropPoints.id],
        }),
    })
);

export const impactEventsRelations = relations(impactEvents, ({ one }) => ({
    user: one(users, {
        fields: [impactEvents.userId],
        references: [users.id],
    }),
    item: one(clothingItems, {
        fields: [impactEvents.itemId],
        references: [clothingItems.id],
    }),
    match: one(matches, {
        fields: [impactEvents.matchId],
        references: [matches.id],
    }),
}));

export const userImpactStatsRelations = relations(userImpactStats, ({ one }) => ({
    user: one(users, {
        fields: [userImpactStats.userId],
        references: [users.id],
    }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
    userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
    user: one(users, {
        fields: [userBadges.userId],
        references: [users.id],
    }),
    badge: one(badges, {
        fields: [userBadges.badgeId],
        references: [badges.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));

// ============================================
// INFERRED TYPES
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type ClothingItem = typeof clothingItems.$inferSelect;
export type NewClothingItem = typeof clothingItems.$inferInsert;

export type ClothingItemPhoto = typeof clothingItemPhotos.$inferSelect;
export type NewClothingItemPhoto = typeof clothingItemPhotos.$inferInsert;

export type ClothingAiAnalysis = typeof clothingAiAnalyses.$inferSelect;
export type NewClothingAiAnalysis = typeof clothingAiAnalyses.$inferInsert;

export type WardrobeLoveScore = typeof wardrobeLoveScores.$inferSelect;
export type NewWardrobeLoveScore = typeof wardrobeLoveScores.$inferInsert;

export type Swipe = typeof swipes.$inferSelect;
export type NewSwipe = typeof swipes.$inferInsert;

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type DropPoint = typeof dropPoints.$inferSelect;
export type NewDropPoint = typeof dropPoints.$inferInsert;

export type DropPointService = typeof dropPointServices.$inferSelect;
export type NewDropPointService = typeof dropPointServices.$inferInsert;

export type SavedDropPoint = typeof savedDropPoints.$inferSelect;
export type NewSavedDropPoint = typeof savedDropPoints.$inferInsert;

export type ImpactEvent = typeof impactEvents.$inferSelect;
export type NewImpactEvent = typeof impactEvents.$inferInsert;

export type UserImpactStat = typeof userImpactStats.$inferSelect;
export type NewUserImpactStat = typeof userImpactStats.$inferInsert;

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;

export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
