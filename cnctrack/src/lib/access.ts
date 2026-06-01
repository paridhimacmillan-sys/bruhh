import sql from '@/lib/db';

export async function getRoleByEmail(email: string | null | undefined): Promise<'admin' | 'employee' | null> {
  if (!email) return null;
  try {
    const rows = await sql<{ role: string }[]>`
      SELECT role FROM app_users WHERE email = ${email.toLowerCase()} LIMIT 1
    `;
    if (!rows.length) return null;
    return rows[0].role === 'admin' ? 'admin' : 'employee';
  } catch {
    return null;
  }
}

