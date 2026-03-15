/**
 * Password Utility Functions
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
    valid: boolean;
    message?: string;
} {
    if (password.length < 6) {
        return {
            valid: false,
            message: "Password must be at least 6 characters",
        };
    }

    // Optional: Add more validation rules
    // if (!/[A-Z]/.test(password)) {
    //   return { valid: false, message: 'Password must contain at least one uppercase letter' };
    // }
    // if (!/[0-9]/.test(password)) {
    //   return { valid: false, message: 'Password must contain at least one number' };
    // }

    return { valid: true };
}
