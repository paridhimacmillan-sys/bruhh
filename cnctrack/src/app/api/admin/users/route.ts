import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { hashPassword } from '@/lib/authDb';

async function getAdminOrg(): Promise<{ organizationId: number } | null> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'admin') return null;
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const rows = await sql<{ organization_id: number }[]>`
    SELECT organization_id FROM app_users WHERE lower(email) = ${email} LIMIT 1
  `;
  const orgId = rows?.[0]?.organization_id;
  if (!orgId) return null;
  return { organizationId: orgId };
}

export async function GET() {
  const admin = await getAdminOrg();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const users = await sql<{ username: string; full_name: string; created_at: string }[]>`
    SELECT username, full_name, created_at
    FROM app_users
    WHERE organization_id = ${admin.organizationId}
      AND role = 'employee'
      AND provider = 'local'
      AND username IS NOT NULL
    ORDER BY created_at DESC
  `;
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const admin = await getAdminOrg();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { username, name, password } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!password || password.length < 4) return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });

  const normalizedUsername = username.trim().toLowerCase();
  const syntheticEmail = `${normalizedUsername}@operator.cnctrack.local`;
  const passwordHash = await hashPassword(password);

  try {
    await sql`
      INSERT INTO app_users (email, username, full_name, role, organization_id, provider, password_hash)
      VALUES (${syntheticEmail}, ${normalizedUsername}, ${(name || username).trim()}, 'employee', ${admin.organizationId}, 'local', ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        updated_at = now()
    `;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    console.error('[admin/users POST]', err);
    return NextResponse.json({ error: 'Database error: ' + msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminOrg();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { username, password } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!password || password.length < 4) return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });

  const passwordHash = await hashPassword(password);
  await sql`
    UPDATE app_users
    SET password_hash = ${passwordHash}, updated_at = now()
    WHERE lower(COALESCE(username, '')) = ${username.trim().toLowerCase()}
      AND organization_id = ${admin.organizationId}
      AND provider = 'local'
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminOrg();
  if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { username } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

  await sql`
    DELETE FROM app_users
    WHERE lower(COALESCE(username, '')) = ${username.trim().toLowerCase()}
      AND organization_id = ${admin.organizationId}
      AND provider = 'local'
  `;
  return NextResponse.json({ ok: true });
}
