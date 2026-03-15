/**
 * Environment Configuration
 */

import "dotenv/config";

export const config = {
    // Server
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    isDev: process.env.NODE_ENV !== "production",

    // Database
    databaseUrl: process.env.DATABASE_URL!,

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || "default-secret-change-in-production",
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        refreshSecret:
            process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    },

    // Google OAuth
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientIds: [
            process.env.GOOGLE_CLIENT_ID || "",
            ...(process.env.GOOGLE_CLIENT_IDS || "")
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean),
        ],
    },

    // Google Places API
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",

    // Gemini AI
    geminiApiKey: process.env.GEMINI_API_KEY || "",

    // Public server URL (used to prefix stored relative paths in API responses)
    appUrl: process.env.APP_URL || `http://localhost:${parseInt(process.env.PORT || "3000", 10)}`,

    // Vercel Blob
    blob: {
        readWriteToken: process.env.BLOB_READ_WRITE_TOKEN || "",
    },

    // Optional antivirus scanner hook
    antivirus: {
        enabled: process.env.ANTIVIRUS_ENABLED === "true",
        scanUrl: process.env.ANTIVIRUS_SCAN_URL || "",
        timeoutMs: parseInt(process.env.ANTIVIRUS_TIMEOUT_MS || "7000", 10),
    },

    // CORS
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:8081",

    // Rate Limiting (increased for swipe-heavy usage)
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10), // 1 minute window
        max: parseInt(process.env.RATE_LIMIT_MAX || "300", 10), // 300 requests per minute
    },
} as const;

// Validate required env vars
const requiredEnvVars = ["DATABASE_URL"];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
