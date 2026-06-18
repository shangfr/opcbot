import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({
  path: ".env.local",
});

const reset = async () => {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("POSTGRES_URL not defined");
    process.exit(1);
  }

  const connection = postgres(connectionString, { max: 1 });
  const db = drizzle(connection);

  console.log("Dropping all tables...");

  await connection.unsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  console.log("All tables dropped. Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("Database reset complete in", end - start, "ms");
  process.exit(0);
};

reset().catch((err) => {
  console.error("Reset failed");
  console.error(err);
  process.exit(1);
});
