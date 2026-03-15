/**
 * Validation Middleware using express-validator
 */

import { Request, Response, NextFunction } from "express";
import { validationResult, body, ValidationChain } from "express-validator";
import { ValidationError } from "../utils/errors.js";

/**
 * Run validation and throw error if fails
 */
export function validate(validations: ValidationChain[]) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        // Run all validations
        await Promise.all(validations.map((validation) => validation.run(req)));

        const errors = validationResult(req);

        if (errors.isEmpty()) {
            return next();
        }

        const formattedErrors = errors.array().map((error) => ({
            field: "path" in error ? error.path : "unknown",
            message: error.msg,
        }));

        next(new ValidationError("Validation failed", formattedErrors));
    };
}

// Common validation rules
export const authValidation = {
    googleAuth: [
        body("idToken").notEmpty().withMessage("Google ID token is required"),
    ],

    completeProfile: [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Name is required")
            .isLength({ min: 2, max: 100 })
            .withMessage("Name must be between 2 and 100 characters"),
        body("phone").optional().trim(),
        body("avatar")
            .optional()
            .trim()
            .custom((value) => {
                // Allow empty, blob URLs, data URLs, and regular URLs
                if (!value) return true;
                if (value.startsWith("blob:")) return true;
                if (value.startsWith("data:")) return true;
                if (value.startsWith("http://") || value.startsWith("https://"))
                    return true;
                if (value.startsWith("file://")) return true;
                throw new Error("Avatar must be a valid URL or image");
            }),
        body("preferences").notEmpty().withMessage("Preferences are required"),
        body("preferences.categories")
            .isArray()
            .withMessage("Categories must be an array"),
        body("preferences.sizes")
            .isArray()
            .withMessage("Sizes must be an array"),
        body("preferences.maxDistanceKm")
            .isNumeric()
            .withMessage("maxDistanceKm must be a number"),
        body("preferences.listingTypes")
            .isArray()
            .withMessage("listingTypes must be an array"),
    ],

    refreshToken: [
        body("refreshToken")
            .notEmpty()
            .withMessage("Refresh token is required"),
    ],
};
