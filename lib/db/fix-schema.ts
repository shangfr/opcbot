/**
 * 一次性修复脚本：解决 migration 不同步问题
 *
 * 背景：
 *  - drizzle.__drizzle_migrations 记录了 8 条（id 1-8），但其中 id=8 的 hash/created_at
 *    与磁盘 journal 不匹配，导致 0008/0009/0010 被误判为已应用。
 *  - 实际数据库 Category 表缺少 sort_order、color_key 两列（0010 的 DDL 未执行）。
 *
 * 本脚本做三件事（幂等）：
 *  1. idempotent 地补上 Category 缺失的两列（ADD COLUMN IF NOT EXISTS）
 *  2. 清空 __drizzle_migrations 表，让 migrate.ts 重新基于 journal 建立记录
 *     —— 由于 0000-0007 的 DDL 实际已全部落到库里，CREATE TABLE IF NOT EXISTS /
 *        ADD COLUMN IF NOT EXISTS 形式让重放安全；但 0000_initial 里的部分 DDL
 *        不带 IF NOT EXISTS，所以不直接重放整个 migrate，而是只清表 + 手动登记
 *        当前 journal 的全部 11 个 hash，避免 Drizzle 再去执行历史 migration。
 *  3. 校验最终 schema。
 */
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
  console.log("=== Step 1: 补 Category 缺失列 (idempotent) ===");
  await sql`
    ALTER TABLE "Category"
      ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "color_key" text DEFAULT 'indigo' NOT NULL
  `;
  console.log("  ✓ Category.sort_order / color_key 已确保存在");

  console.log("\n=== Step 2: 列出当前 Category 列 ===");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Category' ORDER BY ordinal_position
  `;
  console.log("  Category =>", cols.map((c) => c.column_name).join(", "));

  console.log("\n=== Step 3: 修复 __drizzle_migrations ===");
  console.log("  清空旧记录...");
  await sql`DELETE FROM drizzle.__drizzle_migrations`;

  // 读取 journal 并登记全部 11 个 entry，让 migrate.ts 不再重复执行历史
  const fs = await import("fs");
  const journal = JSON.parse(
    fs.readFileSync("./lib/db/migrations/meta/_journal.json", "utf8")
  );
  const crypto = await import("crypto");

  for (const entry of journal.entries) {
    const file = `./lib/db/migrations/${entry.tag}.sql`;
    if (!fs.existsSync(file)) {
      console.log(`  ⚠ 跳过（文件不存在）: ${entry.tag}`);
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    // drizzle 使用 sha256(...) 作为 hash
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`  ✓ 登记 ${entry.tag} (hash=${hash.slice(0, 12)}...)`);
  }

  const count =
    await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
  console.log(`\n  __drizzle_migrations 现有记录: ${count[0].n} 条`);

  console.log("\n=== 完成 ===");
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
