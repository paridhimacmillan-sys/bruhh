import { neon } from '@neondatabase/serverless';

const authDatabaseUrl = process.env.DB_USERS || process.env.DATABASE_URL;

const authSql = authDatabaseUrl
  ? neon(authDatabaseUrl)
  : (() => {
      throw new Error('Set DB_USERS to the Rejection Mapper database connection string.');
    });

export type SharedUser = {
  id: number;
  email: string;
  username: string | null;
  password: string;
  role: string;
  organizationId: number | null;
  organization_id?: number | null;
};

function normalizeSharedUser(row: SharedUser | undefined): SharedUser | null {
  if (!row) return null;
  const rawOrganizationId = row.organizationId ?? row.organization_id ?? null;
  const organizationId = rawOrganizationId === null ? null : Number(rawOrganizationId);
  return {
    ...row,
    email: String(row.email ?? '').toLowerCase(),
    organizationId: Number.isFinite(organizationId) ? organizationId : null,
  };
}

export async function findSharedUser(identifier: string): Promise<SharedUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const rows = await authSql<SharedUser[]>`
    SELECT id, email, username, password, role, organization_id, organization_id AS "organizationId"
    FROM users
    WHERE lower(COALESCE(email, '')) = ${normalized}
       OR lower(COALESCE(username, '')) = ${normalized}
    LIMIT 1
  `;
  return normalizeSharedUser(rows?.[0]);
}

export async function findSharedUserByEmail(email: string): Promise<SharedUser | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await authSql<SharedUser[]>`
    SELECT id, email, username, password, role, organization_id, organization_id AS "organizationId"
    FROM users
    WHERE lower(COALESCE(email, '')) = ${normalized}
    LIMIT 1
  `;
  return normalizeSharedUser(rows?.[0]);
}
