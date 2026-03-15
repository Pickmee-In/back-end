/**
 * Authentication Service
 * Business logic for authentication
 */

import { eq, and, isNull, gt } from "drizzle-orm";
import {
    db,
    users,
    refreshTokens,
    User,
    UserPreferences,
} from "../db/index.js";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    getExpiryInSeconds,
} from "../utils/index.js";
import {
    UnauthorizedError,
    NotFoundError,
} from "../utils/errors.js";
import { config } from "../config/index.js";

export interface GoogleAuthInput {
    idToken: string;
    accessToken?: string;
    email?: string;
    name?: string;
    picture?: string;
}

export interface CompleteProfileInput {
    name: string;
    phone?: string;
    avatar?: string;
    preferences: UserPreferences;
}

export interface AuthResult {
    user: Omit<User, "passwordHash">;
    token: string;
    refreshToken: string;
    expiresIn: number;
    isNewUser: boolean;
    isProfileComplete: boolean;
}

class AuthService {
    /**
     * Login/Register with Google
     */
    async googleAuth(input: GoogleAuthInput): Promise<AuthResult> {
        // Verify Google ID token
        const googleUser = await this.verifyGoogleToken(input.idToken);

        // Find user by Google ID or email
        let [user] = await db
            .select()
            .from(users)
            .where(eq(users.googleId, googleUser.sub))
            .limit(1);

        let isNewUser = false;

        if (!user) {
            // Check if email exists
            [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, googleUser.email.toLowerCase()))
                .limit(1);

            if (user) {
                // Link Google account to existing user
                [user] = await db
                    .update(users)
                    .set({
                        googleId: googleUser.sub,
                        emailVerified: true,
                        emailVerifiedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(users.id, user.id))
                    .returning();
            } else {
                // Create new user
                isNewUser = true;
                [user] = await db
                    .insert(users)
                    .values({
                        name: googleUser.name || googleUser.email.split("@")[0],
                        email: googleUser.email.toLowerCase(),
                        googleId: googleUser.sub,
                        avatar: googleUser.picture,
                        emailVerified: true,
                        emailVerifiedAt: new Date(),
                        isProfileComplete: false,
                    })
                    .returning();
            }
        }

        return this.createAuthResult(user, isNewUser);
    }

    /**
     * Refresh access token
     */
    async refreshToken(
        token: string
    ): Promise<{ token: string; expiresIn: number }> {
        // Verify token
        let decoded;
        try {
            decoded = verifyRefreshToken(token);
        } catch {
            throw new UnauthorizedError(
                "Invalid refresh token",
                "INVALID_REFRESH_TOKEN"
            );
        }

        // Check if token exists and not revoked
        const [storedToken] = await db
            .select()
            .from(refreshTokens)
            .where(
                and(
                    eq(refreshTokens.token, token),
                    isNull(refreshTokens.revokedAt),
                    gt(refreshTokens.expiresAt, new Date())
                )
            )
            .limit(1);

        if (!storedToken) {
            throw new UnauthorizedError(
                "Refresh token expired or revoked",
                "TOKEN_REVOKED"
            );
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, decoded.userId))
            .limit(1);

        if (!user) {
            throw new UnauthorizedError("User not found", "USER_NOT_FOUND");
        }

        // Generate new access token
        const newToken = generateAccessToken(user.id, user.email);
        const expiresIn = getExpiryInSeconds(config.jwt.expiresIn);

        return { token: newToken, expiresIn };
    }

    /**
     * Logout - revoke refresh token
     */
    async logout(userId: string, refreshToken?: string): Promise<void> {
        if (refreshToken) {
            // Revoke specific token
            await db
                .update(refreshTokens)
                .set({ revokedAt: new Date() })
                .where(
                    and(
                        eq(refreshTokens.token, refreshToken),
                        eq(refreshTokens.userId, userId)
                    )
                );
        } else {
            // Revoke all tokens for user
            await db
                .update(refreshTokens)
                .set({ revokedAt: new Date() })
                .where(
                    and(
                        eq(refreshTokens.userId, userId),
                        isNull(refreshTokens.revokedAt)
                    )
                );
        }
    }

    /**
     * Complete user profile
     */
    async completeProfile(
        userId: string,
        input: CompleteProfileInput
    ): Promise<Omit<User, "passwordHash">> {
        const [updatedUser] = await db
            .update(users)
            .set({
                name: input.name,
                phone: input.phone,
                avatar: input.avatar,
                preferences: input.preferences,
                isProfileComplete: true,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) {
            throw new NotFoundError("User not found");
        }

        const { passwordHash: _, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }

    /**
     * Get user by ID
     */
    async getUserById(
        userId: string
    ): Promise<Omit<User, "passwordHash"> | null> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) return null;

        const { passwordHash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    /**
     * Update user profile
     */
    async updateUser(
        userId: string,
        data: Partial<Omit<User, "id" | "email" | "passwordHash">>
    ): Promise<Omit<User, "passwordHash">> {
        const [updatedUser] = await db
            .update(users)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) {
            throw new NotFoundError("User not found");
        }

        const { passwordHash: _, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
    }

    /**
     * Create auth result with tokens
     */
    private async createAuthResult(
        user: User,
        isNewUser: boolean
    ): Promise<AuthResult> {
        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.email);
        const { token: refreshToken, expiresAt } = generateRefreshToken(
            user.id,
            user.email
        );
        const expiresIn = getExpiryInSeconds(config.jwt.expiresIn);

        // Store refresh token
        await db.insert(refreshTokens).values({
            userId: user.id,
            token: refreshToken,
            expiresAt,
        });

        // Remove password from user object
        const { passwordHash: _, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token: accessToken,
            refreshToken,
            expiresIn,
            isNewUser,
            isProfileComplete: user.isProfileComplete,
        };
    }

    /**
     * Verify Google ID token
     */
    private async verifyGoogleToken(idToken: string): Promise<{
        sub: string;
        email: string;
        name?: string;
        picture?: string;
    }> {
        try {
            // Verify token with Google
            const response = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
            );

            if (!response.ok) {
                throw new UnauthorizedError(
                    "Invalid Google token",
                    "INVALID_GOOGLE_TOKEN"
                );
            }

            const payload = (await response.json()) as {
                sub: string;
                email: string;
                name?: string;
                picture?: string;
                aud?: string;
                azp?: string;
                exp?: number;
            };

            // Verify audience against all allowed client IDs
            const allowedClientIds = Array.from(
                new Set(config.google.clientIds.filter(Boolean))
            );

            if (
                allowedClientIds.length > 0 &&
                !allowedClientIds.includes(payload.aud || "")
            ) {
                throw new UnauthorizedError(
                    `Invalid Google token audience. Received: ${payload.aud || "unknown"}`,
                    "INVALID_TOKEN_AUDIENCE"
                );
            }

            // Check expiry
            if (payload.exp && payload.exp < Date.now() / 1000) {
                throw new UnauthorizedError(
                    "Google token expired",
                    "TOKEN_EXPIRED"
                );
            }

            return {
                sub: payload.sub,
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
            };
        } catch (error) {
            if (error instanceof UnauthorizedError) throw error;
            throw new UnauthorizedError(
                "Failed to verify Google token",
                "GOOGLE_VERIFICATION_FAILED"
            );
        }
    }
}

export const authService = new AuthService();
