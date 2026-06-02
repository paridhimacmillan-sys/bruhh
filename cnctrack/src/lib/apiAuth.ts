import { auth } from '@/auth';
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
