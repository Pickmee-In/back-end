/**
 * Authentication Controller
 * HTTP handlers for auth endpoints
 */

import type { NextFunction, Request, Response } from "express";
import sharp from "sharp";

import { eq } from "drizzle-orm";

import { authService } from "../services/auth.service.js";
import { blobStorageService } from "../services/blob-storage.service.js";
import { profileService } from "../services/profile.service.js";
import { db, notifications, users } from "../db/index.js";

/**
 * POST /auth/google
 */
export async function googleAuth(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { idToken, accessToken, email, name, picture } = req.body;

        const result = await authService.googleAuth({
            idToken,
            accessToken,
            email,
            name,
            picture,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/refresh
 */
export async function refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { refreshToken } = req.body;

        const result = await authService.refreshToken(refreshToken);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /auth/logout
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.id;
        const refreshToken = req.body.refreshToken;

        await authService.logout(userId, refreshToken);

        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /auth/complete-profile
 */
export async function completeProfile(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const { name, phone, avatar, preferences } = req.body;

        const user = await authService.completeProfile(userId, {
            name,
            phone,
            avatar,
            preferences,
        });

        res.json({ user });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /users/me
 */
export async function getCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;

        const user = await authService.getUserById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
                code: "NOT_FOUND",
            });
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
}

/**
 * PATCH /users/me
 */
export async function updateCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const { name, phone, avatar, bio, locationLabel, preferences } = req.body;

        const user = await authService.updateUser(userId, {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone }),
            ...(avatar !== undefined && { avatar }),
            ...(bio !== undefined && { bio }),
            ...(locationLabel !== undefined && { locationLabel }),
            ...(preferences !== undefined && { preferences }),
        });

        res.json({ user });
    } catch (error) {
        next(error);
    }
}

/**
 * PATCH /users/me/avatar
 */
export async function updateAvatar(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                message: "No file uploaded",
                code: "NO_FILE",
            });
        }

        const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        const avatarBuffer = await sharp(file.buffer, { failOn: "error" })
            .rotate()
            .resize(400, 400, { fit: "cover", position: "center" })
            .webp({ quality: 90 })
            .toBuffer();

        const uploaded = await blobStorageService.uploadPublicFile({
            folder: "avatars",
            filename: `avatar-${userId}.webp`,
            buffer: avatarBuffer,
            contentType: "image/webp",
        });

        if (existingUser?.avatar) {
            await blobStorageService.deleteByUrl(existingUser.avatar);
        }

        const avatarUrl = uploaded.url;
        const user = await authService.updateUser(userId, { avatar: avatarUrl });

        await db.insert(notifications).values({
            userId,
            type: "system",
            title: "Foto profil diperbarui",
            body: "Avatar profilmu berhasil diganti.",
        });

        res.json({ user });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /users/me/stats
 */
export async function getCurrentUserStats(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = req.user!.id;
        const stats = await profileService.getProfileStats(userId);
        res.json({ stats });
    } catch (error) {
        next(error);
    }
}
