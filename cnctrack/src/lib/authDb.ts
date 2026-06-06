import { promisify } from 'util';
import { scrypt, randomBytes } from 'crypto';
import sql from '@/lib/db';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hash.toString('hex')}.${salt}`;
}

export type AppUser = {
  email: string;
  username: string | null;
  password: string | null;
  role: string;
  organizationId: number | null;
};

/** Find a user in app_users by email or username. Used by auth + API. */
export async function findAppUser(identifier: string): Promise<AppUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const rows = await sql<{ email: string; username: string | null; password_hash: string | null; role: string; organization_id: number | null }[]>`
    SELECT email, username, password_hash, role, organization_id
    FROM app_users
    WHERE lower(email) = ${normalized}
       OR lower(COALESCE(username, '')) = ${normalized}
    LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) return null;
  return {
    email: row.email,
    username: row.username,
    password: row.password_hash,
    role: row.role,
    organizationId: row.organization_id,
  };
}

/** Upsert a Google OAuth admin into app_users. Returns their organizationId. */
export async function syncAppUser({
  email,
  name,
  role,
  provider,
}: {
  email: string;
  name: string | null;
  role: string;
  provider: string;
}): Promise<number | null> {
  const rows = await sql<{ organization_id: number | null }[]>`
    INSERT INTO app_users (email, full_name, role, provider, organization_id)
    VALUES (
      ${email},
      ${name},
      ${role},
      ${provider},
      (SELECT organization_id FROM app_users WHERE role = 'admin' AND provider = 'google' ORDER BY created_at LIMIT 1)
    )
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, app_users.full_name),
      updated_at = now()
    RETURNING organization_id
  `;
  return rows?.[0]?.organization_id ?? null;
}

/** Create an operator account (username + password, set by admin). */
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

export async function listOperatorUsers(organizationId: number) {
  return sql<{ username: string; full_name: string; created_at: string }[]>`
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
  await sql`
    DELETE FROM app_users
    WHERE lower(COALESCE(username, '')) = ${username.trim().toLowerCase()}
      AND organization_id = ${organizationId}
      AND provider = 'local'
  `;
}

export async function updateOperatorPassword(username: string, organizationId: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await sql`
    UPDATE app_users
    SET password_hash = ${passwordHash}, updated_at = now()
    WHERE lower(COALESCE(username, '')) = ${username.trim().toLowerCase()}
      AND organization_id = ${organizationId}
      AND provider = 'local'
  `;
}
