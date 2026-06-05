import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { promisify } from 'util';
import { scrypt, timingSafeEqual } from 'crypto';
import sql from '@/lib/db';
import { findSharedUser, findSharedUserByEmail, findAppUser } from '@/lib/authDb';

const scryptAsync = promisify(scrypt);

async function ensureAuthSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      email text PRIMARY KEY,
      full_name text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT 'employee',
      organization_id integer,
      provider text NOT NULL DEFAULT 'local',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS organization_id integer`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username text`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username ON app_users(lower(username)) WHERE username IS NOT NULL`;
}

async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split('.');
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function syncCncUser(email: string, name: string | null | undefined, role: string, organizationId: number | null) {
  await ensureAuthSchema();
  await sql`
    INSERT INTO app_users (email, full_name, role, organization_id, provider)
    VALUES (${email.toLowerCase()}, ${name ?? ''}, ${role === 'admin' ? 'admin' : 'employee'}, ${organizationId}, 'google')
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
      role = EXCLUDED.role,
      organization_id = COALESCE(EXCLUDED.organization_id, app_users.organization_id),
      provider = 'google',
      updated_at = now()
  `;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifier = String(credentials?.identifier ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!identifier || !password) return null;

        // 1. Try the shared Rejection Mapper users table.
        let user = await findSharedUser(identifier);
        // 2. Fall back to app_users (operator accounts created by admin in CNCTrack).
        if (!user) user = await findAppUser(identifier);
        if (!user?.email || !user?.password) return null;
        const ok = await comparePassword(password, String(user.password));
        if (!ok) return null;
        const role = user.role === 'admin' ? 'admin' : 'employee';
        await syncCncUser(user.email, user.username, role, user.organizationId ?? null);
        return {
          id: String(user.email),
          email: String(user.email).toLowerCase(),
          name: user.username ? String(user.username) : String(user.email),
          role,
          organizationId: user.organizationId ?? null,
        } as any;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = (profile as { email?: string } | undefined)?.email?.toLowerCase();
      if (!email) return false;
      try {
        return Boolean(await findSharedUserByEmail(email));
      } catch (error) {
        console.error('[auth] Shared user lookup failed:', error);
        return false;
      }
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'google') {
        const email = ((profile as { email?: string } | undefined)?.email ?? token.email ?? '').toString().toLowerCase();
        if (!email) return token;
        token.email = email;
        try {
          const sharedUser = await findSharedUserByEmail(email);
          token.role = sharedUser?.role === 'admin' ? 'admin' : 'employee';
          (token as any).organizationId = sharedUser?.organizationId ?? null;
          await syncCncUser(email, token.name ?? null, String(token.role), sharedUser?.organizationId ?? null);
        } catch (error) {
          console.error('[auth] Google profile sync failed:', error);
          token.role = token.role ?? 'employee';
        }
      } else if (account?.provider === 'credentials' && user?.email) {
        token.email = String(user.email).toLowerCase();
        token.role = (user as any).role ?? 'employee';
        (token as any).organizationId = (user as any).organizationId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = String(token.email).toLowerCase();
        (session.user as any).role = token.role ?? 'employee';
        (session.user as any).organizationId = (token as any).organizationId ?? null;
      }
      return session;
    },
  },
});
