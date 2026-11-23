import type { Request, Response } from "express";

import { BadRequestError } from "../utils/errors.js";
import { chatService } from "../services/chat.service.js";

export async function startConversation(req: Request, res: Response) {
    const userId = req.user!.id;
    const { itemId } = req.body;

    if (!itemId) {
        throw new BadRequestError("itemId is required", "ITEM_ID_REQUIRED");
    }

    const result = await chatService.startConversationForItem(userId, itemId);
    res.status(201).json(result);
}

export async function listConversations(req: Request, res: Response) {
    const userId = req.user!.id;
    const result = await chatService.listConversations(userId);
    res.json(result);
}

export async function getConversationDetail(req: Request, res: Response) {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const result = await chatService.getConversationDetail(userId, conversationId);
    res.json(result);
}

export async function sendConversationMessage(req: Request, res: Response) {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const { content } = req.body;
    const result = await chatService.sendMessage(userId, conversationId, String(content ?? ""));
    res.status(201).json(result);
}

export async function completeConversationTransaction(req: Request, res: Response) {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const result = await chatService.completeTransaction(userId, conversationId);
    res.json(result);
}
