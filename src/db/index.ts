/**
 * Database Connection
 * Using Neon Serverless PostgreSQL with Drizzle ORM
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
}

// Create Neon SQL client
const sql = neon(process.env.DATABASE_URL);

// Create Drizzle instance
export const db = drizzle(sql, { schema });

// Export for use in other files
export { sql };
export * from "./schema.js";
