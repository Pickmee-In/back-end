/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, DecodedToken } from "../utils/jwt.js";
import { UnauthorizedError } from "../utils/errors.js";
import { db, users } from "../db/index.js";
import { eq } from "drizzle-orm";

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
                isProfileComplete: boolean;
            };
            token?: DecodedToken;
        }
    }
}

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedError("No token provided", "NO_TOKEN");
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            throw new UnauthorizedError(
                "Invalid token format",
                "INVALID_TOKEN_FORMAT"
            );
        }

        // Verify token
        const decoded = verifyAccessToken(token);

        if (decoded.type !== "access") {
            throw new UnauthorizedError(
                "Invalid token type",
                "INVALID_TOKEN_TYPE"
            );
        }

        // Get user from database
        const [user] = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                isProfileComplete: users.isProfileComplete,
            })
            .from(users)
            .where(eq(users.id, decoded.userId))
            .limit(1);

        if (!user) {
            throw new UnauthorizedError("User not found", "USER_NOT_FOUND");
        }

        // Attach user to request
        req.user = user;
        req.token = decoded;

        next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            next(error);
        } else if (
            error instanceof Error &&
            error.name === "JsonWebTokenError"
        ) {
            next(new UnauthorizedError("Invalid token", "INVALID_TOKEN"));
        } else if (
            error instanceof Error &&
            error.name === "TokenExpiredError"
        ) {
            next(new UnauthorizedError("Token expired", "TOKEN_EXPIRED"));
        } else {
            next(new UnauthorizedError("Authentication failed", "AUTH_FAILED"));
        }
    }
}

/**
 * Optional authentication - attach user if token is valid, but don't fail if not
 */
export async function optionalAuthenticate(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return next();
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return next();
        }

        const decoded = verifyAccessToken(token);

        if (decoded.type !== "access") {
            return next();
        }

        const [user] = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                isProfileComplete: users.isProfileComplete,
            })
            .from(users)
            .where(eq(users.id, decoded.userId))
            .limit(1);

        if (user) {
            req.user = user;
            req.token = decoded;
        }

        next();
    } catch {
        // Ignore errors for optional auth
        next();
    }
}
