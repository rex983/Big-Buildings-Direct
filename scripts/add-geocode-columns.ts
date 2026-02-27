/**
 * One-time migration: add latitude/longitude columns to the Supabase `orders` table.
 * Run with: npx tsx scripts/add-geocode-columns.ts
 *
 * If the Prisma role lacks ALTER TABLE permissions, run this SQL in your
 * Supabase SQL Editor instead:
 *
 *   ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude double precision;
 *   ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude double precision;
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding latitude/longitude columns to orders table...");

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude double precision;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude double precision;`
    );
    console.log("Done — latitude and longitude columns added.");
  } catch (error) {
    console.error("Migration failed:", error);
    console.log("\nIf this is a permissions issue, run the following SQL in your Supabase SQL Editor:");
    console.log("  ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude double precision;");
    console.log("  ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude double precision;");
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
