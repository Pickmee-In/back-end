import { and, desc, eq, inArray } from "drizzle-orm";

import { db, notifications } from "../db/index.js";
import { NotFoundError } from "../utils/errors.js";

class NotificationService {
    async listForUser(userId: string) {
        const rows = await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userId))
            .orderBy(desc(notifications.createdAt));

        const unreadCount = rows.filter((row) => !row.isRead).length;

        return {
            unreadCount,
            notifications: rows.map((row) => ({
                id: row.id,
                type: row.type,
                title: row.title,
                body: row.body,
                data: row.data,
                isRead: row.isRead,
                createdAt: row.createdAt,
            })),
        };
    }

    async markRead(userId: string, notificationId: string) {
        const [existing] = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
            .limit(1);

        if (!existing) {
            throw new NotFoundError("Notification not found");
        }

        const [updated] = await db
            .update(notifications)
            .set({ isRead: true, readAt: new Date() })
            .where(eq(notifications.id, notificationId))
            .returning();

        return updated;
    }

    async markAllRead(userId: string) {
        const rows = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

        if (rows.length === 0) {
            return { updated: 0 };
        }

        await db
            .update(notifications)
            .set({ isRead: true, readAt: new Date() })
            .where(inArray(notifications.id, rows.map((row) => row.id)));

        return { updated: rows.length };
    }
}

export const notificationService = new NotificationService();
