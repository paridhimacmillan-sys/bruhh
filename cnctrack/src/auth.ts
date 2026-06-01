import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { promisify } from 'util';
import { scrypt, timingSafeEqual } from 'crypto';
import sql from '@/lib/db';

const scryptAsync = promisify(scrypt);

async function ensureAuthSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      email text PRIMARY KEY,
      full_name text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT 'employee',
      provider text NOT NULL DEFAULT 'local',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username text`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username ON app_users(lower(username)) WHERE username IS NOT NULL`;
}

async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split('.');
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function upsertGoogleUser(email: string, name: string | null | undefined) {
  await ensureAuthSchema();
  await sql`
    INSERT INTO app_users (email, full_name, role, provider)
    VALUES (${email.toLowerCase()}, ${name ?? ''}, 'employee', 'google')
    ON CONFLICT (email) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), app_users.full_name),
      provider = 'google',
      updated_at = now()
  `;
}

async function getRoleByEmail(email: string): Promise<'admin' | 'employee'> {
  try {
    const rows = await sql<{ role: string }[]>`
      SELECT role FROM app_users WHERE email = ${email.toLowerCase()} LIMIT 1
    `;
    return rows?.[0]?.role === 'admin' ? 'admin' : 'employee';
  } catch {
    return 'employee';
  }
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
        await ensureAuthSchema();
        const rows = await sql<any[]>`
          SELECT * FROM app_users
          WHERE lower(email) = ${identifier}
             OR lower(COALESCE(username, '')) = ${identifier}
          LIMIT 1
        `;
        const user = rows?.[0];
        if (!user?.email || !user?.password_hash) return null;
        const ok = await comparePassword(password, String(user.password_hash));
        if (!ok) return null;
        return {
          id: String(user.email),
          email: String(user.email).toLowerCase(),
          name: user.full_name ? String(user.full_name) : String(user.email),
          role: user.role === 'admin' ? 'admin' : 'employee',
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
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'google') {
        const email = ((profile as { email?: string } | undefined)?.email ?? token.email ?? '').toString().toLowerCase();
        if (!email) return token;
        token.email = email;
        try {
          await upsertGoogleUser(email, token.name ?? null);
          token.role = await getRoleByEmail(email);
        } catch (error) {
          console.error('[auth] Google profile sync failed:', error);
          token.role = token.role ?? 'employee';
        }
      } else if (account?.provider === 'credentials' && user?.email) {
        token.email = String(user.email).toLowerCase();
        token.role = (user as any).role ?? 'employee';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = String(token.email).toLowerCase();
        (session.user as any).role = token.role ?? 'employee';
      }
      return session;
    },
  },
});
