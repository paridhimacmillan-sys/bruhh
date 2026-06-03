import { auth } from '@/auth';
import { findSharedUserByEmail } from '@/lib/authDb';
import sql from '@/lib/db';

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return false;
  if ((session.user as { role?: string }).role === 'admin') return true;

  const adminEmails = parseAdminEmails();
  if (adminEmails.has(email)) return true;

  try {
    const rows = await sql<{ role: string }[]>`
      SELECT role FROM app_users WHERE email = ${email} LIMIT 1
    `;
    return rows?.[0]?.role === 'admin';
  } catch {
    return false;
  }
}

export async function requireOrganizationId(): Promise<number | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  // 1. Always try the live DB first — JWT can be stale (minted before org was assigned).
  try {
    const rows = await sql<{ organization_id: number | null }[]>`
      SELECT organization_id FROM app_users WHERE email = ${email} LIMIT 1
    `;
    const localOrganizationId = rows?.[0]?.organization_id ?? null;
    if (localOrganizationId) return localOrganizationId;
  } catch {
    // DB unreachable — fall through and try the JWT cache below.
  }

  // 2. Fall back to the JWT value (avoids a hard failure if app_users DB is momentarily down).
  const sessionOrg = (session?.user as { organizationId?: unknown } | undefined)?.organizationId;
  if (typeof sessionOrg === 'number' && Number.isFinite(sessionOrg)) return sessionOrg;
  if (typeof sessionOrg === 'string' && sessionOrg.trim()) {
    const parsed = Number(sessionOrg);
    if (Number.isFinite(parsed)) return parsed;
  }

  // 3. Last resort: check the shared Rejection Mapper users table.
  try {
    const sharedUser = await findSharedUserByEmail(email);
    return sharedUser?.organizationId ?? null;
  } catch {
    return null;
  }
}
