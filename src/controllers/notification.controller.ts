import type { Request, Response } from "express";

import { notificationService } from "../services/notification.service.js";

export async function listNotifications(req: Request, res: Response) {
    const userId = req.user!.id;
    const result = await notificationService.listForUser(userId);
    res.json(result);
}

export async function markNotificationRead(req: Request, res: Response) {
    const userId = req.user!.id;
    const result = await notificationService.markRead(userId, req.params.id);
    res.json({ notification: result });
}

export async function markAllNotificationsRead(req: Request, res: Response) {
    const userId = req.user!.id;
    const result = await notificationService.markAllRead(userId);
    res.json(result);
}
