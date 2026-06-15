import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!connectionString) {
  console.log("No connection string");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log("=== Checking tables ===");
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  console.log("Tables in public schema:");
  for (const t of tables) {
    console.log("  -", t.tablename);
  }

  console.log("\n=== Checking Category table columns ===");
  try {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Category'
      ORDER BY ordinal_position;
    `;
    if (cols.length === 0) {
      console.log("  Category table DOES NOT EXIST!");
    } else {
      for (const c of cols) {
        console.log("  -", c.column_name, ":", c.data_type,
          c.is_nullable === "YES" ? "NULL" : "NOT NULL",
          c.column_default ? `DEFAULT ${c.column_default}` : "");
      }
    }
  } catch (e) {
    console.log("  Error checking Category:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== Drizzle migrations log ===");
  try {
    const migrations = await sql`
      SELECT id, hash, created_at
      FROM drizzle.__drizzle_migrations
      ORDER BY id;
    `;
    for (const m of migrations) {
      console.log(`  - id=${m.id} hash=${m.hash} created=${m.created_at}`);
    }
    console.log(`Total migrations recorded: ${migrations.length}`);
  } catch (e) {
    console.log("  Error reading migrations:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== Migration files on disk ===");
  const fs = await import("fs");
  const files = fs.readdirSync("./lib/db/migrations")
    .filter((f: string) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    console.log("  -", f);
  }

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
