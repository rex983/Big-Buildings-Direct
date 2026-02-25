// Quick check of SQLite DB contents using raw SQL via a temp connection
// We'll use better-sqlite3 since Prisma is now pointed at PostgreSQL

import { execSync } from "child_process";

// Install better-sqlite3 temporarily for inspection
try {
  require.resolve("better-sqlite3");
} catch {
  console.log("Installing better-sqlite3 temporarily...");
  execSync("npm install --no-save better-sqlite3", { cwd: process.cwd(), stdio: "inherit" });
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3");
const db = new Database("prisma/dev.db", { readonly: true });

const tables = [
  "User",
  '"Order"',
  "Manufacturer",
  "Revision",
  "OrderChange",
  "File",
  "Ticket",
  "Role",
  "Permission",
  "OrderStage",
  "PayPlan",
  "PayLedger",
];

console.log("=== SQLite Database Contents ===");
for (const table of tables) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    console.log(`${table.replace(/"/g, "")}: ${row.count}`);
  } catch {
    console.log(`${table.replace(/"/g, "")}: (table not found)`);
  }
}

db.close();
