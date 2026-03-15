import { and, desc, eq, inArray, ne } from "drizzle-orm";

import {
    clothingItemPhotos,
    clothingItems,
    conversationParticipants,
    conversations,
    db,
    matches,
    messages,
    notifications,
    users,
} from "../db/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { config } from "../config/index.js";

function toAbsoluteUrl(relPath: string | null | undefined): string | null {
    if (!relPath) return null;
    if (relPath.startsWith("http://") || relPath.startsWith("https://")) return relPath;
    return `${config.appUrl}${relPath}`;
}

function formatTime(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

class ChatService {
    async startConversationForItem(userId: string, itemId: string) {
        const [item] = await db
            .select()
            .from(clothingItems)
            .where(and(eq(clothingItems.id, itemId), eq(clothingItems.status, "active")))
            .limit(1);

        if (!item) {
            throw new NotFoundError("Item not found");
        }

        if (item.ownerId === userId) {
            throw new BadRequestError("Cannot chat with your own item", "OWN_ITEM_CHAT");
        }

        let [match] = await db
            .select()
            .from(matches)
            .where(and(eq(matches.itemId, itemId), eq(matches.pickerId, userId)))
            .limit(1);

        if (!match) {
            [match] = await db
                .insert(matches)
                .values({
                    itemId,
                    ownerId: item.ownerId,
                    pickerId: userId,
                    status: "pending",
                })
                .returning();
        }

        let [conversation] = await db
            .select()
            .from(conversations)
            .where(eq(conversations.matchId, match.id))
            .limit(1);

        if (!conversation) {
            [conversation] = await db
                .insert(conversations)
                .values({ matchId: match.id })
                .returning();

            await db.insert(conversationParticipants).values([
                {
                    conversationId: conversation.id,
                    userId: item.ownerId,
                    role: "owner",
                },
                {
                    conversationId: conversation.id,
                    userId,
                    role: "picker",
                },
            ]);

            await db.insert(notifications).values({
                userId: item.ownerId,
                type: "chat",
                title: "Percakapan baru dimulai",
                body: `Seseorang membuka chat untuk ${item.title}`,
                data: { itemId, conversationId: conversation.id },
            });
        }

        const full = await this.getConversationDetail(userId, conversation.id);
        return full;
    }

    async listConversations(userId: string) {
        const myParticipants = await db
            .select()
            .from(conversationParticipants)
            .where(eq(conversationParticipants.userId, userId));

        if (myParticipants.length === 0) {
            return { conversations: [] };
        }

        const conversationIds = myParticipants.map((row) => row.conversationId);
        const conversationRows = await db
            .select()
            .from(conversations)
            .where(inArray(conversations.id, conversationIds))
            .orderBy(desc(conversations.updatedAt));

        const otherParticipants = await db
            .select({
                conversationId: conversationParticipants.conversationId,
                userId: users.id,
                name: users.name,
                avatar: users.avatar,
            })
            .from(conversationParticipants)
            .innerJoin(users, eq(conversationParticipants.userId, users.id))
            .where(
                and(
                    inArray(conversationParticipants.conversationId, conversationIds),
                    ne(conversationParticipants.userId, userId)
                )
            );

        const messageRows = await db
            .select()
            .from(messages)
            .where(inArray(messages.conversationId, conversationIds))
            .orderBy(desc(messages.createdAt));

        const matchesRows = await db
            .select()
            .from(matches)
            .where(inArray(matches.id, conversationRows.map((row) => row.matchId)));

        const itemIds = matchesRows.map((row) => row.itemId);
        const items = itemIds.length
            ? await db.select().from(clothingItems).where(inArray(clothingItems.id, itemIds))
            : [];
        const photos = itemIds.length
            ? await db.select().from(clothingItemPhotos).where(inArray(clothingItemPhotos.itemId, itemIds))
            : [];

        const latestMessageMap = new Map<string, typeof messageRows[number]>();
        for (const row of messageRows) {
            if (!latestMessageMap.has(row.conversationId)) {
                latestMessageMap.set(row.conversationId, row);
            }
        }

        const matchMap = new Map(matchesRows.map((row) => [row.id, row]));
        const itemMap = new Map(items.map((row) => [row.id, row]));
        const otherMap = new Map(otherParticipants.map((row) => [row.conversationId, row]));
        const photoMap = new Map<string, string>();
        for (const row of photos) {
            const current = photoMap.get(row.itemId);
            if (!current || row.isPrimary) {
                photoMap.set(row.itemId, row.url);
            }
        }

        const unreadMap = new Map<string, number>();
        for (const row of messageRows) {
            if (row.senderId === userId) continue;
            const lastRead = myParticipants.find((p) => p.conversationId === row.conversationId)?.lastReadAt;
            if (!lastRead || new Date(row.createdAt) > new Date(lastRead)) {
                unreadMap.set(row.conversationId, (unreadMap.get(row.conversationId) ?? 0) + 1);
            }
        }

        return {
            conversations: conversationRows.map((row) => {
                const other = otherMap.get(row.id);
                const latest = latestMessageMap.get(row.id);
                const match = matchMap.get(row.matchId);
                const item = match ? itemMap.get(match.itemId) : null;
                return {
                    id: row.id,
                    otherUser: {
                        id: other?.userId ?? "",
                        name: other?.name ?? "Unknown User",
                        avatarUrl: other?.avatar ?? null,
                    },
                    item: item
                        ? {
                              id: item.id,
                              title: item.title,
                              imageUrl: toAbsoluteUrl(photoMap.get(item.id)) ?? null,
                          }
                        : null,
                    lastMessage: latest?.content ?? "",
                    lastMessageAt: latest?.createdAt ?? row.updatedAt,
                    lastMessageTime: formatTime(latest?.createdAt ?? row.updatedAt),
                    unreadCount: unreadMap.get(row.id) ?? 0,
                };
            }),
        };
    }

    async getConversationDetail(userId: string, conversationId: string) {
        const [participant] = await db
            .select()
            .from(conversationParticipants)
            .where(
                and(
                    eq(conversationParticipants.conversationId, conversationId),
                    eq(conversationParticipants.userId, userId)
                )
            )
            .limit(1);

        if (!participant) {
            throw new NotFoundError("Conversation not found");
        }

        const [conversation] = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);
        if (!conversation) {
            throw new NotFoundError("Conversation not found");
        }

        const [other] = await db
            .select({
                id: users.id,
                name: users.name,
                avatar: users.avatar,
            })
            .from(conversationParticipants)
            .innerJoin(users, eq(conversationParticipants.userId, users.id))
            .where(
                and(
                    eq(conversationParticipants.conversationId, conversationId),
                    ne(conversationParticipants.userId, userId)
                )
            )
            .limit(1);

        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, conversation.matchId))
            .limit(1);
        const [item] = match
            ? await db.select().from(clothingItems).where(eq(clothingItems.id, match.itemId)).limit(1)
            : [];
        const itemPhotos = item
            ? await db.select().from(clothingItemPhotos).where(eq(clothingItemPhotos.itemId, item.id))
            : [];

        await db
            .update(conversationParticipants)
            .set({ lastReadAt: new Date() })
            .where(eq(conversationParticipants.id, participant.id));

        const rows = await db
            .select({
                id: messages.id,
                content: messages.content,
                createdAt: messages.createdAt,
                senderId: messages.senderId,
                senderName: users.name,
            })
            .from(messages)
            .innerJoin(users, eq(messages.senderId, users.id))
            .where(eq(messages.conversationId, conversationId))
            .orderBy(messages.createdAt);

        return {
            conversation: {
                id: conversation.id,
                otherUser: {
                    id: other?.id ?? "",
                    name: other?.name ?? "Unknown User",
                    avatarUrl: other?.avatar ?? null,
                },
                item: item
                    ? {
                          id: item.id,
                          title: item.title,
                          imageUrl: toAbsoluteUrl(itemPhotos.find((row) => row.isPrimary)?.url ?? itemPhotos[0]?.url) ?? null,
                      }
                    : null,
                messages: rows.map((row) => ({
                    id: row.id,
                    text: row.content,
                    senderId: row.senderId,
                    senderName: row.senderName,
                    isSent: row.senderId === userId,
                    timestamp: row.createdAt,
                    timestampLabel: formatTime(row.createdAt),
                })),
            },
        };
    }

    async sendMessage(userId: string, conversationId: string, content: string) {
        const trimmed = content.trim();
        if (!trimmed) {
            throw new BadRequestError("Message content is required", "MESSAGE_REQUIRED");
        }

        const [participant] = await db
            .select()
            .from(conversationParticipants)
            .where(
                and(
                    eq(conversationParticipants.conversationId, conversationId),
                    eq(conversationParticipants.userId, userId)
                )
            )
            .limit(1);
        if (!participant) {
            throw new NotFoundError("Conversation not found");
        }

        const [message] = await db
            .insert(messages)
            .values({
                conversationId,
                senderId: userId,
                type: "text",
                content: trimmed,
            })
            .returning();

        await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));

        await db
            .update(conversationParticipants)
            .set({ lastReadAt: new Date() })
            .where(eq(conversationParticipants.id, participant.id));

        const otherParticipants = await db
            .select({ userId: conversationParticipants.userId })
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, conversationId));

        const targetUserIds = otherParticipants
            .map((row) => row.userId)
            .filter((id) => id !== userId);

        if (targetUserIds.length > 0) {
            const [sender] = await db
                .select({ name: users.name })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

            await db.insert(notifications).values(
                targetUserIds.map((targetUserId) => ({
                    userId: targetUserId,
                    type: "chat" as const,
                    title: `Pesan dari ${sender?.name ?? 'Pengguna'}`,
                    body: trimmed,
                    data: { conversationId },
                }))
            );
        }

        return {
            message: {
                id: message.id,
                text: message.content,
                senderId: message.senderId,
                isSent: true,
                timestamp: message.createdAt,
                timestampLabel: formatTime(message.createdAt),
            },
        };
    }
}

export const chatService = new ChatService();
