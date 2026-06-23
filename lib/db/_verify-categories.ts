import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });

async function main() {
  const rows = await sql`
    SELECT id, name, color, sort_order, color_key
    FROM "Category"
    ORDER BY sort_order ASC, "createdAt" ASC
  `;
  console.log("Category rows:", rows.length);
  for (const r of rows) {
    console.log(
      "  -",
      r.name,
      "| color:",
      r.color,
      "| sort:",
      r.sort_order,
      "| key:",
      r.color_key
    );
  }
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
