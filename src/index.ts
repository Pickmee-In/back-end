/**
 * Terserah.in Backend API
 * Main entry point
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

import { config } from "./config/index.js";
import { pool } from "./db/index.js";
import routes from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

// Create Express app
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS - Allow mobile apps and web clients
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) return callback(null, true);
            
            // Allow localhost for development
            if (config.isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }
            
            // Allow configured frontend URL
            if (origin === config.frontendUrl) {
                return callback(null, true);
            }
            
            // Allow Expo development
            if (config.isDev && origin.startsWith('exp://')) {
                return callback(null, true);
            }
            
            // For production, you might want to be more restrictive
            // For now, allow all origins for mobile app compatibility
            callback(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        message: "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (config.isDev) {
    app.use(morgan("dev"));
} else {
    app.use(morgan("combined"));
}

// Static uploads
app.use("/uploads", express.static(config.storage.uploadDir, { dotfiles: "deny" }));

// Health check (outside /api for load balancer)
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.get("/ready", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ status: "ok", database: "connected" });
    } catch {
        res.status(503).json({ status: "unavailable" });
    }
});

// API routes
app.use("/api", routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, config.host, () => {
    console.log(`
🚀 Terserah.in API Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 URL: http://localhost:${config.port}
📍 API: http://localhost:${config.port}/api
🔧 Environment: ${config.nodeEnv}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully...");
    server.close(async () => {
        await pool.end();
        console.log("Server closed");
        process.exit(0);
    });
});

export default app;
