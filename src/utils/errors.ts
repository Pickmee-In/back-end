/**
 * Custom Error Classes
 */

export class AppError extends Error {
    statusCode: number;
    code: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number, code?: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code || "ERROR";
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = "Bad request", code?: string) {
        super(message, 400, code || "BAD_REQUEST");
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = "Unauthorized", code?: string) {
        super(message, 401, code || "UNAUTHORIZED");
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "Forbidden", code?: string) {
        super(message, 403, code || "FORBIDDEN");
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = "Not found", code?: string) {
        super(message, 404, code || "NOT_FOUND");
    }
}

export class ConflictError extends AppError {
    constructor(message: string = "Conflict", code?: string) {
        super(message, 409, code || "CONFLICT");
    }
}

export class ValidationError extends AppError {
    errors: Record<string, string>[];

    constructor(
        message: string = "Validation failed",
        errors: Record<string, string>[] = []
    ) {
        super(message, 422, "VALIDATION_ERROR");
        this.errors = errors;
    }
}

export class InternalError extends AppError {
    constructor(message: string = "Internal server error") {
        super(message, 500, "INTERNAL_ERROR");
    }
}
