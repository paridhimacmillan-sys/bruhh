import { neon } from '@neondatabase/serverless';
import { promisify } from 'util';
import { scrypt, randomBytes } from 'crypto';
import sql from '@/lib/db';

const scryptAsync = promisify(scrypt);

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

export type OperatorAccount = {
  username: string;
  full_name: string;
  created_at: string;
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

// ---------------------------------------------------------------------------
// Operator accounts — stored in app_users (main CNCTrack DB, not shared DB)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hash.toString('hex')}.${salt}`;
}

/** Check app_users for username/password login (operator accounts). */
export async function findAppUser(identifier: string): Promise<SharedUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const rows = await sql<{ email: string; username: string | null; password_hash: string | null; role: string; organization_id: number | null }[]>`
    SELECT email, username, password_hash, role, organization_id
    FROM app_users
    WHERE (lower(COALESCE(username, '')) = ${normalized} OR lower(email) = ${normalized})
      AND password_hash IS NOT NULL
    LIMIT 1
  `;
  const row = rows?.[0];
  if (!row || !row.password_hash) return null;
  return {
    id: 0,
    email: row.email,
    username: row.username,
    password: row.password_hash,
    role: row.role,
    organizationId: row.organization_id,
  };
}

export async function createOperatorUser({
  username,
  name,
  password,
  organizationId,
}: {
  username: string;
  name: string;
  password: string;
  organizationId: number;
}): Promise<void> {
  const normalizedUsername = username.trim().toLowerCase();
  const syntheticEmail = `${normalizedUsername}@operator.cnctrack.local`;
  const passwordHash = await hashPassword(password);
  await sql`
    INSERT INTO app_users (email, username, full_name, role, organization_id, provider, password_hash)
    VALUES (${syntheticEmail}, ${normalizedUsername}, ${name.trim()}, 'employee', ${organizationId}, 'local', ${passwordHash})
    ON CONFLICT (email) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      password_hash = EXCLUDED.password_hash,
      updated_at = now()
  `;
}

export async function listOperatorUsers(organizationId: number): Promise<OperatorAccount[]> {
  return sql<OperatorAccount[]>`
    SELECT username, full_name, created_at
    FROM app_users
    WHERE organization_id = ${organizationId}
      AND role = 'employee'
      AND provider = 'local'
      AND username IS NOT NULL
    ORDER BY created_at DESC
  `;
}

export async function deleteOperatorUser(username: string, organizationId: number): Promise<void> {
  const normalizedUsername = username.trim().toLowerCase();
  await sql`
    DELETE FROM app_users
    WHERE lower(COALESCE(username, '')) = ${normalizedUsername}
      AND organization_id = ${organizationId}
      AND provider = 'local'
  `;
}
