import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import sql from '@/lib/db';

function isConfigured() {
  return Boolean(
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET)
  );
}

async function upsertAppUser(email: string | null | undefined, name: string | null | undefined) {
  if (!email) return;
  const normalizedEmail = email.toLowerCase();

  // Mirror admin role from Rejection Mapper by email when possible.
  // Falls back to employee when source table is unavailable or user is not admin there.
  let mirroredRole: 'admin' | 'employee' = 'employee';
  try {
    const rows = await sql<{ role: string }[]>`
      SELECT role
      FROM users
      WHERE lower(email) = ${normalizedEmail}
      LIMIT 1
    `;
    const sourceRole = rows?.[0]?.role;
    mirroredRole = sourceRole === 'admin' ? 'admin' : 'employee';
  } catch {
    // Rejection Mapper table may not exist in this DB; keep safe default.
    mirroredRole = 'employee';
  }

  await sql`
    INSERT INTO app_users (email, full_name, role, provider)
    VALUES (${normalizedEmail}, ${name ?? ''}, ${mirroredRole}, 'google')
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
      role = EXCLUDED.role,
      provider = 'google'
  `;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: isConfigured()
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
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
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google') {
        const email = (token.email ?? (profile as { email?: string } | undefined)?.email) ?? null;
        await upsertAppUser(email, token.name);
      }
      return token;
    },
  },
});
