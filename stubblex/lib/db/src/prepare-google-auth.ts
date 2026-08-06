import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be set before preparing Google authentication columns");

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_subject" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
  `);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_google_subject_unique') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_google_subject_unique" UNIQUE ("google_subject");
      END IF;
    END
    $$;
  `);
  await client.query("COMMIT");
  console.info("Prepared Google authentication columns and unique constraints without deleting existing users.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
