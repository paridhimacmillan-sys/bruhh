import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { promisify } from 'util';
import { scrypt, timingSafeEqual } from 'crypto';
import sql from '@/lib/db';
import { findAppUser, syncAppUser } from '@/lib/authDb';

const scryptAsync = promisify(scrypt);

async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split('.');
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },

  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!identifier || !password) return null;
        const user = await findAppUser(identifier);
        if (!user?.password) return null;
        const ok = await comparePassword(password, user.password);
        if (!ok) return null;
        // Fetch fresh organizationId from DB
        const rows = await sql<{ organization_id: number | null }[]>`
          SELECT organization_id FROM app_users WHERE lower(email) = ${user.email} LIMIT 1
        `;
        const organizationId = rows?.[0]?.organization_id ?? user.organizationId ?? null;
        return {
          id: user.email,
          email: user.email,
          name: user.username ?? user.email,
          role: user.role,
          organizationId,
        };
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
  if (account?.provider === 'google') {
    const email = user.email?.toLowerCase();
    if (!email) return false;
    // Only check real Google accounts, not synthetic operator emails
    const existing = await sql<{ role: string; provider: string }[]>`
      SELECT role, provider FROM app_users 
      WHERE lower(email) = ${email} AND provider = 'google'
      LIMIT 1
    `;
    if (existing.length > 0) return existing[0].role === 'admin';
    // Bootstrap: allow first Google sign-in
    const rows = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM app_users WHERE provider = 'google'
    `;
    const total = parseInt(rows[0]?.count ?? '0', 10);
    return total === 0;
  }
  return true;
},

    async session({ session, token }) {
      session.user.email = String(token.email ?? '').toLowerCase();
      (session.user as any).role = token.role ?? 'employee';
      (session.user as any).organizationId = token.organizationId ?? null;
      return session;
    },
  },

  pages: { signIn: '/login', error: '/login' },
});
