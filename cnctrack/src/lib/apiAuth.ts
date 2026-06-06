import { auth } from '@/auth';
import { findAppUser } from '@/lib/authDb';
import sql from '@/lib/db';

export async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return (session?.user as any)?.role === 'admin';
}

export async function requireOrganizationId(): Promise<number | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  // 1. Try JWT first (fast path)
  const sessionOrg = (session?.user as any)?.organizationId;
  if (typeof sessionOrg === 'number' && Number.isFinite(sessionOrg)) return sessionOrg;

  // 2. Always verify from DB (handles stale JWTs)
  try {
    const rows = await sql<{ organization_id: number | null }[]>`
      SELECT organization_id FROM app_users WHERE lower(email) = ${email} LIMIT 1
    `;
    const orgId = rows?.[0]?.organization_id ?? null;
    if (orgId) return orgId;
  } catch { /* fall through */ }

  // 3. Last resort: lookup by username
  try {
    const user = await findAppUser(email);
    return user?.organizationId ?? null;
  } catch {
    return null;
  }
}
