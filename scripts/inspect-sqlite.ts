import Database from "better-sqlite3";

const db = new Database("prisma/dev.db", { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite%'").all() as { name: string }[];

for (const { name } of tables) {
  const info = db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string; notnull: number }[];
  const count = (db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as { c: number }).c;
  console.log(`\n=== ${name} (${count} rows) ===`);
  info.forEach((col) => console.log(`  ${col.name}: ${col.type}${col.notnull ? " NOT NULL" : ""}`));
}

db.close();
