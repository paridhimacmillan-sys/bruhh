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
  // If source is unavailable (timeouts), do not overwrite existing CNC role.
  let mirroredRole: 'admin' | 'employee' | null = null;
  try {
    const rows = await sql<{ role: string }[]>`
      SELECT role
      FROM users
      WHERE lower(email) = ${normalizedEmail}
      LIMIT 1
    `;
    const sourceRole = rows?.[0]?.role ?? null;
    if (sourceRole === 'admin') mirroredRole = 'admin';
    else if (sourceRole === 'employee') mirroredRole = 'employee';
  } catch {
    // Rejection Mapper table may not exist / may timeout; preserve existing role.
    mirroredRole = null;
  }

  if (mirroredRole) {
    await sql`
      INSERT INTO app_users (email, full_name, role, provider)
      VALUES (${normalizedEmail}, ${name ?? ''}, ${mirroredRole}, 'google')
      ON CONFLICT (email) DO UPDATE SET
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
        role = EXCLUDED.role,
        provider = 'google'
    `;
    return;
  }

  // Source role unavailable: create/update user without changing existing role.
  await sql`
    INSERT INTO app_users (email, full_name, role, provider)
    VALUES (${normalizedEmail}, ${name ?? ''}, 'employee', 'google')
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
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
        const googleEmail = (profile as { email?: string } | undefined)?.email?.toLowerCase() ?? null;
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
