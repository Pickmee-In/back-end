/**
 * Group Service
 * Handles group creation, management, and voting
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
    groups,
    groupMembers,
    groupRestaurants,
    swipeResults,
    matches,
    chatMessages,
    Group,
    NewGroup,
    GroupMember,
    GroupRestaurant,
    GroupPreferences,
    MemberPreferences,
    restaurants,
    users,
    Restaurant,
} from "../db/schema.js";
import { restaurantService } from "./restaurant.service.js";
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
} from "../utils/errors.js";

// Number of restaurants to show for voting (narrowed down)
const VOTING_RESTAURANT_COUNT = 5;

// Generate random join code
function generateJoinCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

interface CreateGroupInput {
    name: string;
    ownerId: string;
    maxMembers?: number;
    votingDuration?: number;
    latitude?: number;
    longitude?: number;
    maxDistance?: number;
    preferences?: GroupPreferences;
}

interface GroupWithMembers extends Group {
    members: (GroupMember & {
        user: { id: string; name: string; avatar: string | null };
    })[];
    memberCount: number;
}

interface VoteInput {
    groupId: string;
    userId: string;
    restaurantId: string;
    action: "like" | "dislike" | "super_like";
}

class GroupService {
    /**
     * Create a new group
     */
    async create(input: CreateGroupInput): Promise<GroupWithMembers> {
        // Generate unique join code
        let code = generateJoinCode();
        let attempts = 0;
        while (attempts < 10) {
            const [existing] = await db
                .select()
                .from(groups)
                .where(eq(groups.code, code))
                .limit(1);

            if (!existing) break;
            code = generateJoinCode();
            attempts++;
        }

        if (attempts >= 10) {
            throw new BadRequestError("Failed to generate unique join code");
        }

        // Create group
        const [group] = await db
            .insert(groups)
            .values({
                name: input.name,
                code,
                ownerId: input.ownerId,
                maxMembers: input.maxMembers || 10,
                votingDuration: input.votingDuration || 300,
                latitude: input.latitude ? String(input.latitude) : null,
                longitude: input.longitude ? String(input.longitude) : null,
                maxDistance: input.maxDistance || 5,
                preferences: input.preferences || {
                    categories: [],
                    priceRange: { min: 0, max: 500000 },
                    minRating: 3.5,
                },
                status: "waiting",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
            })
            .returning();

        // Add owner as member with owner role (not ready yet, needs to submit preferences)
        await db.insert(groupMembers).values({
            groupId: group.id,
            userId: input.ownerId,
            role: "owner",
            isReady: false,
        });

        // Return group with members
        return this.getById(group.id);
    }

    /**
     * Get group by ID with members
     */
    async getById(groupId: string): Promise<GroupWithMembers> {
        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, groupId))
            .limit(1);

        if (!group) {
            throw new NotFoundError("Group not found");
        }

        // Get members with user info
        const membersResult = await db
            .select({
                member: groupMembers,
                user: {
                    id: users.id,
                    name: users.name,
                    avatar: users.avatar,
                },
            })
            .from(groupMembers)
            .innerJoin(users, eq(groupMembers.userId, users.id))
            .where(eq(groupMembers.groupId, groupId));

        const members = membersResult.map((row) => ({
            ...row.member,
            user: row.user,
        }));

        return {
            ...group,
            members,
            memberCount: members.length,
        };
    }

    /**
     * Get group by join code
     */
    async getByCode(code: string): Promise<GroupWithMembers> {
        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.code, code.toUpperCase()))
            .limit(1);

        if (!group) {
            throw new NotFoundError("Group not found");
        }

        return this.getById(group.id);
    }

    /**
     * Join a group by code
     */
    async join(userId: string, code: string): Promise<GroupWithMembers> {
        const group = await this.getByCode(code);

        // Check if group is still accepting members
        if (group.status !== "waiting") {
            throw new BadRequestError("Group is no longer accepting members");
        }

        // Check if group is full
        if (group.memberCount >= group.maxMembers) {
            throw new BadRequestError("Group is full");
        }

        // Check if already a member
        const existingMember = group.members.find((m) => m.userId === userId);
        if (existingMember) {
            throw new BadRequestError("Already a member of this group");
        }

        // Check if expired - properly parse the date
        if (group.expiresAt) {
            const expiresAt =
                group.expiresAt instanceof Date
                    ? group.expiresAt
                    : new Date(group.expiresAt);
            const now = new Date();
            console.log(
                "[GroupService] Expiration check - expiresAt:",
                expiresAt.toISOString(),
                "now:",
                now.toISOString(),
                "isExpired:",
                expiresAt < now
            );
            if (expiresAt < now) {
                throw new BadRequestError("Group has expired");
            }
        }

        // Add as member
        await db.insert(groupMembers).values({
            groupId: group.id,
            userId,
            role: "member",
            isReady: false,
        });

        // Add system message
        await this.addSystemMessage(group.id, userId, "joined");

        return this.getById(group.id);
    }

    /**
     * Leave a group
     */
    async leave(userId: string, groupId: string): Promise<void> {
        const group = await this.getById(groupId);

        // Check if user is a member
        const member = group.members.find((m) => m.userId === userId);
        if (!member) {
            throw new BadRequestError("Not a member of this group");
        }

        // Owner cannot leave, must delete group instead
        if (member.role === "owner") {
            throw new BadRequestError(
                "Owner cannot leave. Delete the group instead."
            );
        }

        // Remove member
        await db
            .delete(groupMembers)
            .where(
                and(
                    eq(groupMembers.groupId, groupId),
                    eq(groupMembers.userId, userId)
                )
            );

        // Add system message
        await this.addSystemMessage(groupId, userId, "left");
    }

    /**
     * Submit member preferences and set ready
     */
    async submitMemberPreferences(
        userId: string,
        groupId: string,
        preferences: MemberPreferences
    ): Promise<GroupMember> {
        const group = await this.getById(groupId);

        if (group.status !== "waiting") {
            throw new BadRequestError("Group is not in waiting state");
        }

        const member = group.members.find((m) => m.userId === userId);
        if (!member) {
            throw new BadRequestError("Not a member of this group");
        }

        const [updated] = await db
            .update(groupMembers)
            .set({
                preferences,
                isReady: true,
            })
            .where(
                and(
                    eq(groupMembers.groupId, groupId),
                    eq(groupMembers.userId, userId)
                )
            )
            .returning();

        return updated;
    }

    /**
     * Update ready status
     */
    async setReady(
        userId: string,
        groupId: string,
        isReady: boolean
    ): Promise<GroupMember> {
        const group = await this.getById(groupId);

        if (group.status !== "waiting") {
            throw new BadRequestError("Group is not in waiting state");
        }

        const member = group.members.find((m) => m.userId === userId);
        if (!member) {
            throw new BadRequestError("Not a member of this group");
        }

        const [updated] = await db
            .update(groupMembers)
            .set({ isReady })
            .where(
                and(
                    eq(groupMembers.groupId, groupId),
                    eq(groupMembers.userId, userId)
                )
            )
            .returning();

        return updated;
    }

    /**
     * Calculate average preferences from all members
     */
    private calculateAveragePreferences(
        membersList: GroupMember[]
    ): GroupPreferences {
        const membersWithPrefs = membersList.filter((m) => m.preferences);

        if (membersWithPrefs.length === 0) {
            return {
                categories: [],
                priceRange: { min: 0, max: 500000 },
                minRating: 3.5,
            };
        }

        // Collect all categories (union of all member categories)
        const allCategories = new Set<string>();
        membersWithPrefs.forEach((m) => {
            m.preferences?.categories?.forEach((cat) => allCategories.add(cat));
        });

        // Calculate average price range
        let totalMinPrice = 0;
        let totalMaxPrice = 0;
        let totalMinRating = 0;

        membersWithPrefs.forEach((m) => {
            if (m.preferences?.priceRange) {
                totalMinPrice += m.preferences.priceRange.min;
                totalMaxPrice += m.preferences.priceRange.max;
            }
            if (m.preferences?.minRating) {
                totalMinRating += m.preferences.minRating;
            }
        });

        const count = membersWithPrefs.length;

        return {
            categories: Array.from(allCategories),
            priceRange: {
                min: Math.round(totalMinPrice / count),
                max: Math.round(totalMaxPrice / count),
            },
            minRating: Math.round((totalMinRating / count) * 10) / 10, // Round to 1 decimal
        };
    }

    /**
     * Start voting session
     */
    async startVoting(userId: string, groupId: string): Promise<Group> {
        const group = await this.getById(groupId);

        // Only owner can start voting
        const member = group.members.find((m) => m.userId === userId);
        if (!member || member.role !== "owner") {
            throw new ForbiddenError("Only the owner can start voting");
        }

        if (group.status !== "waiting") {
            throw new BadRequestError("Group is not in waiting state");
        }

        // Check if location is set
        if (!group.latitude || !group.longitude) {
            throw new BadRequestError(
                "Location must be set before starting voting"
            );
        }

        // Get all members with their preferences
        const membersWithPrefs = await db
            .select()
            .from(groupMembers)
            .where(eq(groupMembers.groupId, groupId));

        // Calculate average preferences from all members
        const averagePrefs = this.calculateAveragePreferences(
            membersWithPrefs as any
        );

        console.log(`[GroupService] Starting voting for group ${groupId}`);
        console.log(
            `[GroupService] Calculated average preferences:`,
            averagePrefs
        );

        // Update group with calculated average preferences
        await db
            .update(groups)
            .set({
                preferences: averagePrefs,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId));

        // Fetch restaurants based on average preferences
        const nearbyRestaurants = await restaurantService.searchWithPreferences(
            parseFloat(group.latitude),
            parseFloat(group.longitude),
            {
                ...averagePrefs,
                maxDistance: group.maxDistance || 5,
            },
            20 // Fetch more initially
        );

        if (nearbyRestaurants.length === 0) {
            throw new BadRequestError("No restaurants found nearby");
        }

        // Narrow down to VOTING_RESTAURANT_COUNT (5) restaurants
        // Pick the top-rated restaurants that match the most categories
        const scoredRestaurants = nearbyRestaurants.map((r) => {
            let score = 0;
            // Score based on rating
            score += (parseFloat(String(r.rating)) || 0) * 10;
            // Score based on category match
            const matchedCategories = (r.categories || []).filter((cat) =>
                averagePrefs.categories.includes(cat)
            ).length;
            score += matchedCategories * 5;
            return { ...r, matchScore: score };
        });

        // Sort by score and take top VOTING_RESTAURANT_COUNT
        const topRestaurants = scoredRestaurants
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, VOTING_RESTAURANT_COUNT);

        console.log(
            `[GroupService] Selected ${topRestaurants.length} restaurants for voting`
        );

        // Add restaurants to group
        for (const restaurant of topRestaurants) {
            await db
                .insert(groupRestaurants)
                .values({
                    groupId: group.id,
                    restaurantId: restaurant.id,
                })
                .onConflictDoNothing();
        }

        // Update group status
        const votingEndsAt = new Date(Date.now() + group.votingDuration * 1000);

        const [updated] = await db
            .update(groups)
            .set({
                status: "voting",
                votingStartedAt: new Date(),
                votingEndsAt,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId))
            .returning();

        return updated;
    }

    /**
     * Get restaurants for voting
     */
    async getVotingRestaurants(groupId: string): Promise<GroupRestaurant[]> {
        const result = await db
            .select({
                groupRestaurant: groupRestaurants,
                restaurant: restaurants,
            })
            .from(groupRestaurants)
            .innerJoin(
                restaurants,
                eq(groupRestaurants.restaurantId, restaurants.id)
            )
            .where(eq(groupRestaurants.groupId, groupId));

        return result.map((row) => ({
            ...row.groupRestaurant,
            restaurant: row.restaurant,
        })) as any;
    }

    /**
     * Submit a vote
     */
    async vote(input: VoteInput): Promise<void> {
        const group = await this.getById(input.groupId);

        if (group.status !== "voting") {
            throw new BadRequestError("Voting is not active");
        }

        // Check if member
        const member = group.members.find((m) => m.userId === input.userId);
        if (!member) {
            throw new BadRequestError("Not a member of this group");
        }

        // Check if voting time expired
        if (group.votingEndsAt && new Date(group.votingEndsAt) < new Date()) {
            throw new BadRequestError("Voting has ended");
        }

        // Check if restaurant is in group
        const [groupRestaurant] = await db
            .select()
            .from(groupRestaurants)
            .where(
                and(
                    eq(groupRestaurants.groupId, input.groupId),
                    eq(groupRestaurants.restaurantId, input.restaurantId)
                )
            )
            .limit(1);

        if (!groupRestaurant) {
            throw new BadRequestError("Restaurant not in voting list");
        }

        // Check if already voted on this restaurant
        const [existingVote] = await db
            .select()
            .from(swipeResults)
            .where(
                and(
                    eq(swipeResults.groupId, input.groupId),
                    eq(swipeResults.userId, input.userId),
                    eq(swipeResults.restaurantId, input.restaurantId)
                )
            )
            .limit(1);

        if (existingVote) {
            throw new BadRequestError("Already voted on this restaurant");
        }

        // Record vote
        await db.insert(swipeResults).values({
            groupId: input.groupId,
            userId: input.userId,
            restaurantId: input.restaurantId,
            action: input.action,
        });

        // Update restaurant scores
        const scoreIncrement =
            input.action === "super_like"
                ? 3
                : input.action === "like"
                ? 1
                : -1;
        const updateFields = {
            score: sql`${groupRestaurants.score} + ${scoreIncrement}`,
            ...(input.action === "like" && {
                totalLikes: sql`${groupRestaurants.totalLikes} + 1`,
            }),
            ...(input.action === "dislike" && {
                totalDislikes: sql`${groupRestaurants.totalDislikes} + 1`,
            }),
            ...(input.action === "super_like" && {
                totalSuperLikes: sql`${groupRestaurants.totalSuperLikes} + 1`,
            }),
        };

        await db
            .update(groupRestaurants)
            .set(updateFields)
            .where(eq(groupRestaurants.id, groupRestaurant.id));
    }

    /**
     * Complete voting and get results
     */
    async completeVoting(groupId: string): Promise<GroupRestaurant[]> {
        const group = await this.getById(groupId);

        if (group.status !== "voting") {
            throw new BadRequestError("Voting is not active");
        }

        // Get ranked results
        const results = await db
            .select({
                groupRestaurant: groupRestaurants,
                restaurant: restaurants,
            })
            .from(groupRestaurants)
            .innerJoin(
                restaurants,
                eq(groupRestaurants.restaurantId, restaurants.id)
            )
            .where(eq(groupRestaurants.groupId, groupId))
            .orderBy(desc(groupRestaurants.score));

        // Update group status
        await db
            .update(groups)
            .set({
                status: "completed",
                completedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId));

        // Create match with top result
        if (results.length > 0) {
            await db.insert(matches).values({
                groupId,
                restaurantId: results[0].groupRestaurant.restaurantId,
                score: results[0].groupRestaurant.score,
            });
        }

        // Mark all members as voted
        await db
            .update(groupMembers)
            .set({ hasVoted: true, votedAt: new Date() })
            .where(eq(groupMembers.groupId, groupId));

        return results.map((row) => ({
            ...row.groupRestaurant,
            restaurant: row.restaurant,
        })) as any;
    }

    /**
     * Force complete voting (owner only)
     */
    async forceCompleteVoting(
        userId: string,
        groupId: string
    ): Promise<GroupRestaurant[]> {
        const group = await this.getById(groupId);

        // Only owner can force complete
        const member = group.members.find((m) => m.userId === userId);
        if (!member || member.role !== "owner") {
            throw new ForbiddenError(
                "Only the owner can force complete voting"
            );
        }

        if (group.status !== "voting") {
            throw new BadRequestError("Voting is not active");
        }

        return this.completeVoting(groupId);
    }

    /**
     * Check if voting should auto-complete (time expired) and complete if needed
     */
    async checkAndAutoComplete(
        groupId: string
    ): Promise<{ completed: boolean; results?: GroupRestaurant[] }> {
        const group = await this.getById(groupId);

        if (group.status !== "voting") {
            return { completed: false };
        }

        // Check if voting time expired
        if (group.votingEndsAt && new Date(group.votingEndsAt) < new Date()) {
            const results = await this.completeVoting(groupId);
            return { completed: true, results };
        }

        return { completed: false };
    }

    /**
     * Get voting progress - who has voted on what
     */
    async getVotingProgress(groupId: string): Promise<{
        totalMembers: number;
        membersVoted: number;
        restaurantsCount: number;
        votesPerRestaurant: {
            restaurantId: string;
            restaurantName: string;
            votes: number;
        }[];
        memberProgress: {
            userId: string;
            userName: string;
            votesCount: number;
            isComplete: boolean;
        }[];
    }> {
        const group = await this.getById(groupId);

        // Get all votes for this group
        const votes = await db
            .select()
            .from(swipeResults)
            .where(eq(swipeResults.groupId, groupId));

        // Get restaurants for this group
        const groupRests = await db
            .select({
                groupRestaurant: groupRestaurants,
                restaurant: restaurants,
            })
            .from(groupRestaurants)
            .innerJoin(
                restaurants,
                eq(groupRestaurants.restaurantId, restaurants.id)
            )
            .where(eq(groupRestaurants.groupId, groupId));

        const totalRestaurants = groupRests.length;

        // Calculate votes per restaurant
        const votesPerRestaurant = groupRests.map((gr) => {
            const restaurantVotes = votes.filter(
                (v) => v.restaurantId === gr.restaurant.id
            );
            return {
                restaurantId: gr.restaurant.id,
                restaurantName: gr.restaurant.name,
                votes: restaurantVotes.length,
            };
        });

        // Calculate member progress
        const memberProgress = group.members.map((m) => {
            const memberVotes = votes.filter((v) => v.userId === m.userId);
            return {
                userId: m.userId,
                userName: m.user.name,
                votesCount: memberVotes.length,
                isComplete: memberVotes.length >= totalRestaurants,
            };
        });

        const membersVoted = memberProgress.filter(
            (m) => m.votesCount > 0
        ).length;

        return {
            totalMembers: group.members.length,
            membersVoted,
            restaurantsCount: totalRestaurants,
            votesPerRestaurant,
            memberProgress,
        };
    }

    /**
     * Get matched restaurant for completed group
     */
    async getMatchedRestaurant(groupId: string): Promise<Restaurant | null> {
        const group = await this.getById(groupId);

        if (group.status !== "completed") {
            return null;
        }

        const [match] = await db
            .select({
                restaurant: restaurants,
            })
            .from(matches)
            .innerJoin(restaurants, eq(matches.restaurantId, restaurants.id))
            .where(eq(matches.groupId, groupId))
            .orderBy(desc(matches.createdAt))
            .limit(1);

        return match?.restaurant || null;
    }

    /**
     * Update group location
     */
    async updateLocation(
        userId: string,
        groupId: string,
        latitude: number,
        longitude: number
    ): Promise<Group> {
        const group = await this.getById(groupId);

        // Only owner can update location
        const member = group.members.find((m) => m.userId === userId);
        if (!member || member.role !== "owner") {
            throw new ForbiddenError("Only the owner can update location");
        }

        const [updated] = await db
            .update(groups)
            .set({
                latitude: String(latitude),
                longitude: String(longitude),
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId))
            .returning();

        return updated;
    }

    /**
     * Update group preferences
     */
    async updatePreferences(
        userId: string,
        groupId: string,
        preferences: GroupPreferences
    ): Promise<Group> {
        const group = await this.getById(groupId);

        // Only owner can update preferences
        const member = group.members.find((m) => m.userId === userId);
        if (!member || member.role !== "owner") {
            throw new ForbiddenError("Only the owner can update preferences");
        }

        const [updated] = await db
            .update(groups)
            .set({
                preferences,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId))
            .returning();

        return updated;
    }

    /**
     * Delete group
     */
    async delete(userId: string, groupId: string): Promise<void> {
        const group = await this.getById(groupId);

        // Only owner can delete
        const member = group.members.find((m) => m.userId === userId);
        if (!member || member.role !== "owner") {
            throw new ForbiddenError("Only the owner can delete the group");
        }

        await db.delete(groups).where(eq(groups.id, groupId));
    }

    /**
     * Get user's groups (with matched restaurant for completed groups)
     */
    async getUserGroups(
        userId: string
    ): Promise<
        (GroupWithMembers & { matchedRestaurant?: Restaurant | null })[]
    > {
        const memberships = await db
            .select()
            .from(groupMembers)
            .where(eq(groupMembers.userId, userId));

        const userGroups: (GroupWithMembers & {
            matchedRestaurant?: Restaurant | null;
        })[] = [];
        for (const membership of memberships) {
            try {
                const group = await this.getById(membership.groupId);

                // If group is completed/matched, get the matched restaurant
                let matchedRestaurant: Restaurant | null = null;
                if (group.status === "completed") {
                    matchedRestaurant = await this.getMatchedRestaurant(
                        group.id
                    );
                }

                userGroups.push({
                    ...group,
                    matchedRestaurant,
                });
            } catch {
                // Group may have been deleted
            }
        }

        return userGroups.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        );
    }

    // ============================================
    // CHAT
    // ============================================

    /**
     * Add system message
     */
    private async addSystemMessage(
        groupId: string,
        userId: string,
        action: "joined" | "left"
    ): Promise<void> {
        // Get user name
        const [user] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        const message =
            action === "joined"
                ? `${user?.name || "Someone"} joined the group`
                : `${user?.name || "Someone"} left the group`;

        await db.insert(chatMessages).values({
            groupId,
            userId,
            message,
            isSystem: true,
        });
    }

    /**
     * Send chat message
     */
    async sendMessage(
        groupId: string,
        userId: string,
        message: string
    ): Promise<typeof chatMessages.$inferSelect> {
        const group = await this.getById(groupId);

        // Check if member
        const member = group.members.find((m) => m.userId === userId);
        if (!member) {
            throw new BadRequestError("Not a member of this group");
        }

        const [chatMessage] = await db
            .insert(chatMessages)
            .values({
                groupId,
                userId,
                message,
                isSystem: false,
            })
            .returning();

        return chatMessage;
    }

    /**
     * Get chat messages
     */
    async getMessages(groupId: string, limit: number = 50): Promise<any[]> {
        const result = await db
            .select({
                message: chatMessages,
                user: {
                    id: users.id,
                    name: users.name,
                    avatar: users.avatar,
                },
            })
            .from(chatMessages)
            .innerJoin(users, eq(chatMessages.userId, users.id))
            .where(eq(chatMessages.groupId, groupId))
            .orderBy(desc(chatMessages.createdAt))
            .limit(limit);

        return result
            .map((row) => ({
                ...row.message,
                user: row.user,
            }))
            .reverse();
    }
}

export const groupService = new GroupService();
