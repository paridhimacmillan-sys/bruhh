import sql from '@/lib/db';

export interface AccessInfo {
  authenticated: boolean;
  email: string | null;
  role: 'admin' | 'employee' | null;
  isAdmin: boolean;
}

export async function getRoleByEmail(email: string | null | undefined): Promise<'admin' | 'employee' | null> {
  if (!email) return null;
  const rows = await sql`SELECT role FROM app_users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0].role === 'admin' ? 'admin' : 'employee';
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

