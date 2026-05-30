import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import sql from '@/lib/db';

function isConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

async function upsertAppUser(email: string | null | undefined, name: string | null | undefined) {
  if (!email) return;
  await sql`
    INSERT INTO app_users (email, full_name, role, provider)
    VALUES (${email.toLowerCase()}, ${name ?? ''}, 'employee', 'google')
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
      provider = 'google'
  `;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: isConfigured() ? [Google] : [],
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

