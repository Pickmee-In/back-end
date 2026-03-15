/**
 * JWT Utility Functions
 */

import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/index.js";

export interface TokenPayload {
    userId: string;
    email: string;
    type: "access" | "refresh";
}

export interface DecodedToken extends TokenPayload {
    iat: number;
    exp: number;
    jti: string;
}

/**
 * Generate access token
 */
export function generateAccessToken(userId: string, email: string): string {
    const payload: TokenPayload = {
        userId,
        email,
        type: "access",
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as string | number,
        jwtid: uuidv4(),
    } as jwt.SignOptions);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(
    userId: string,
    email: string
): { token: string; expiresAt: Date } {
    const payload: TokenPayload = {
        userId,
        email,
        type: "refresh",
    };

    const token = jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn as string | number,
        jwtid: uuidv4(),
    } as jwt.SignOptions);

    // Calculate expiry date
    const expiresIn = config.jwt.refreshExpiresIn;
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    let expiresAt = new Date();

    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case "d":
                expiresAt.setDate(expiresAt.getDate() + value);
                break;
            case "h":
                expiresAt.setHours(expiresAt.getHours() + value);
                break;
            case "m":
                expiresAt.setMinutes(expiresAt.getMinutes() + value);
                break;
            case "s":
                expiresAt.setSeconds(expiresAt.getSeconds() + value);
                break;
        }
    } else {
        // Default to 7 days
        expiresAt.setDate(expiresAt.getDate() + 7);
    }

    return { token, expiresAt };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): DecodedToken {
    return jwt.verify(token, config.jwt.secret) as DecodedToken;
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): DecodedToken {
    return jwt.verify(token, config.jwt.refreshSecret) as DecodedToken;
}

/**
 * Calculate token expiry in seconds
 */
export function getExpiryInSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([dhms])$/);

    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case "d":
            return value * 24 * 60 * 60;
        case "h":
            return value * 60 * 60;
        case "m":
            return value * 60;
        case "s":
            return value;
        default:
            return 3600;
    }
}
