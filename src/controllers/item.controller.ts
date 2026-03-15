import type { Request, Response } from "express";

import { BadRequestError } from "../utils/errors.js";
import { itemService } from "../services/item.service.js";

function mapTruthy(v: unknown): boolean {
    const value = String(v ?? "").toLowerCase();
    return value === "1" || value === "true" || value === "yes";
}

export async function analyzeItemPhoto(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
        throw new BadRequestError("photo is required", "PHOTO_REQUIRED");
    }

    const result = await itemService.analyzePhotoWithGemini(file);

    if (!result.success) {
        res.status(200).json({
            success: false,
            aiAnalysis: result,
            manualInputRequired: true,
        });
        return;
    }

    res.json({
        success: true,
        aiAnalysis: result,
        manualInputRequired: false,
    });
}

export async function createItem(req: Request, res: Response) {
    const userId = req.user!.id;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    const {
        title,
        description,
        category,
        size,
        condition,
        listingType,
        isFree,
        price,
        latitude,
        longitude,
        locationLabel,
    } = req.body;

    if (!category || !size || !condition || !listingType) {
        throw new BadRequestError(
            "category, size, condition, and listingType are required",
            "MISSING_REQUIRED_FIELDS"
        );
    }

    const created = await itemService.createItem(userId, {
        title,
        description,
        category,
        size,
        condition,
        listingType,
        isFree: mapTruthy(isFree),
        price,
        latitude,
        longitude,
        locationLabel,
        photos: files,
    });

    res.status(201).json({
        message: "Item listed successfully",
        ...created,
    });
}

export async function listMyItems(req: Request, res: Response) {
    const userId = req.user!.id;
    const result = await itemService.listMyItems(userId);
    res.json(result);
}

export async function getMyItemDetail(req: Request, res: Response) {
    const userId = req.user!.id;
    const itemId = req.params.id;
    const result = await itemService.getMyItemById(userId, itemId);
    res.json(result);
}

export async function updateItem(req: Request, res: Response) {
    const userId = req.user!.id;
    const itemId = req.params.id;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    const {
        title,
        description,
        category,
        size,
        condition,
        listingType,
        isFree,
        price,
        latitude,
        longitude,
        locationLabel,
    } = req.body;

    const updated = await itemService.updateItem(userId, itemId, {
        title,
        description,
        category,
        size,
        condition,
        listingType,
        isFree: isFree != null ? mapTruthy(isFree) : undefined,
        price,
        latitude,
        longitude,
        locationLabel,
        photos: files.length ? files : undefined,
    });

    res.json({
        message: "Item updated successfully",
        ...updated,
    });
}

export async function deleteItem(req: Request, res: Response) {
    const userId = req.user!.id;
    const itemId = req.params.id;

    const result = await itemService.deleteItem(userId, itemId);
    res.json(result);
}
