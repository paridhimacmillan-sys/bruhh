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

        return {
          id: user.email,
          email: user.email,
          name: user.username ?? user.email,
          role: user.role,
          organizationId: user.organizationId,
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
        const existing = await findAppUser(email);
        if (existing) return existing.role === 'admin';
        // Bootstrap: allow the very first Google sign-in and make them admin
        const rows = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM app_users`;
        const total = parseInt(rows[0]?.count ?? '0', 10);
        return total === 0;
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        const email = String(user.email ?? '').toLowerCase();
        token.email = email;
        if (account?.provider === 'google') {
          const orgId = await syncAppUser({ email, name: user.name ?? null, role: 'admin', provider: 'google' });
          token.role = 'admin';
          token.organizationId = orgId;
        } else {
          token.role = (user as any).role ?? 'employee';
          token.organizationId = (user as any).organizationId ?? null;
        }
      }
      return token;
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
