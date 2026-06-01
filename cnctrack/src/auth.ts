import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import sql from '@/lib/db';

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function getAllowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS ?? '';
  return raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email: string | null): boolean {
  if (!email) return false;
  const allowedDomains = getAllowedDomains();
  if (allowedDomains.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return allowedDomains.includes(domain);
}

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  const emails = raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
  );
}

async function safeSqlRoleFromAppUsers(email: string): Promise<'admin' | 'employee' | null> {
  try {
    const rows = await sql<{ role: string }[]>`
      SELECT role
      FROM app_users
      WHERE lower(email) = ${email}
      LIMIT 1
    `;
    const role = rows?.[0]?.role?.toLowerCase?.() ?? null;
    if (role === 'admin') return 'admin';
    if (role === 'employee') return 'employee';
    return null;
  } catch {
    return null;
  }
}

async function upsertAppUser(email: string | null | undefined, name: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const adminEmails = getAdminEmails();
  const existingRole = await safeSqlRoleFromAppUsers(normalizedEmail);

  // Role precedence:
  // 1) Explicit ADMIN_EMAILS override
  // 2) Existing app_users role
  // 3) Employee default
  const resolvedRole: 'admin' | 'employee' =
    adminEmails.has(normalizedEmail)
      ? 'admin'
      : existingRole ?? 'employee';

  await sql`
    INSERT INTO app_users (email, full_name, role, provider)
    VALUES (${normalizedEmail}, ${name ?? ''}, ${resolvedRole}, 'google')
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
      role = EXCLUDED.role,
      provider = 'google'
  `;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: isConfigured()
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
          authorization: {
            params: {
              prompt: 'select_account',
            },
          },
        }),
      ]
    : [],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      const googleEmail = normalizeEmail((profile as { email?: string } | undefined)?.email ?? null);
      return isAllowedEmail(googleEmail);
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google') {
        const googleEmail = normalizeEmail((profile as { email?: string } | undefined)?.email ?? null);
        if (googleEmail) token.email = googleEmail;
        await upsertAppUser(googleEmail ?? token.email ?? null, token.name);
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.email && session.user) {
        session.user.email = String(token.email).toLowerCase();
      }
      return session;
    },
  },
});
