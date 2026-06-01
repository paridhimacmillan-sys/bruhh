import sql from '@/lib/db';

export interface AccessInfo {
  authenticated: boolean;
  email: string | null;
  role: 'admin' | 'employee' | null;
  isAdmin: boolean;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function getRoleByEmail(email: string | null | undefined): Promise<'admin' | 'employee' | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (getAdminEmails().has(normalized)) return 'admin';
  try {
    const rows = await sql`SELECT role FROM app_users WHERE email = ${normalized} LIMIT 1`;
    if (rows.length === 0) return null;
    return rows[0].role === 'admin' ? 'admin' : 'employee';
  } catch (err) {
    console.error('[access] role lookup failed:', err);
    return null;
  }
}

export async function getAccessInfo(email: string | null | undefined): Promise<AccessInfo> {
  const role = await getRoleByEmail(email);
  return {
    authenticated: Boolean(email),
    email: email ?? null,
    role,
    isAdmin: role === 'admin',
  };
}
