/**
 * Error Handler Middleware
 */

import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError, ValidationError } from "../utils/errors.js";
import { config } from "../config/index.js";

interface ErrorResponse {
    message: string;
    code: string;
    errors?: Record<string, string>[];
    stack?: string;
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error("Error:", err);

    // Default error
    let statusCode = 500;
    let response: ErrorResponse = {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
    };

    // Handle AppError
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        response = {
            message: err.message,
            code: err.code,
        };

        // Include validation errors
        if (err instanceof ValidationError) {
            response.errors = err.errors;
        }
    }

    // Handle Multer errors
    if (err instanceof multer.MulterError) {
        statusCode = 400;
        response = {
            message:
                err.code === "LIMIT_FILE_SIZE"
                    ? "Image too large. Maximum size is 8MB per file"
                    : err.code === "LIMIT_FILE_COUNT"
                      ? "Too many files. Maximum is 5 photos"
                      : `Upload error: ${err.message}`,
            code: "UPLOAD_ERROR",
        };
    }

    // Include stack trace in development
    if (config.isDev) {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * Handle 404 Not Found
 */
export function notFoundHandler(
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    res.status(404).json({
        message: `Route ${req.method} ${req.path} not found`,
        code: "NOT_FOUND",
    });
}
