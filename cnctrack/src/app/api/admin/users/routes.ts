import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireOrganizationId } from '@/lib/apiAuth';
import { createOperatorUser, listOperatorUsers, deleteOperatorUser, updateOperatorPassword } from '@/lib/authDb';

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const users = await listOperatorUsers(organizationId);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { username, name, password } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!password || password.length < 4) return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });

  try {
    await createOperatorUser({ username, name: name || username, password, organizationId });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    throw err;
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { username, password } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!password || password.length < 4) return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });

  await updateOperatorPassword(username, organizationId, password);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { username } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  await deleteOperatorUser(username, organizationId);
  return NextResponse.json({ ok: true });
}
