/**
 * Database Migration Script
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import "dotenv/config";

async function runMigrations() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    console.log("🔄 Running migrations...");

    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("✅ Migrations completed!");
    process.exit(0);
}

runMigrations().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
