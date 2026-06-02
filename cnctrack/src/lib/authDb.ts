import { neon } from '@neondatabase/serverless';

const authDatabaseUrl = process.env.DB_USERS || process.env.DATABASE_URL;

const authSql = authDatabaseUrl
  ? neon(authDatabaseUrl)
  : (() => {
      throw new Error('Set DB_USERS to the Rejection Mapper database connection string.');
    });

export type SharedUser = {
  email: string;
  username: string | null;
  password: string;
  role: string;
};

export async function findSharedUser(identifier: string): Promise<SharedUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const rows = await authSql<SharedUser[]>`
    SELECT email, username, password, role
    FROM users
    WHERE lower(COALESCE(email, '')) = ${normalized}
       OR lower(COALESCE(username, '')) = ${normalized}
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

export async function findSharedUserByEmail(email: string): Promise<SharedUser | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await authSql<SharedUser[]>`
    SELECT email, username, password, role
    FROM users
    WHERE lower(COALESCE(email, '')) = ${normalized}
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}
