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
  const rows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name IN ('Chat', 'Category', 'Agent')
    ORDER BY table_name, ordinal_position;
  `;
  const grouped: Record<string, string[]> = {};
  for (const r of rows) {
    (grouped[r.table_name] ??= []).push(r.column_name);
  }
  for (const [t, cols] of Object.entries(grouped)) {
    console.log(t, "=>", cols.join(", "));
  }
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
