import { NextRequest, NextResponse } from 'next/server';
import { dbDeleteMachine, dbUpdateMachine } from '@/lib/neon';
import { requireAdmin, requireOrganizationId } from '@/lib/apiAuth';
import { Machine } from '@/lib/mockData';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = (await req.json()) as Partial<Machine>;
  await dbUpdateMachine(params.id, data, organizationId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbDeleteMachine(params.id, organizationId);
  return NextResponse.json({ ok: true });
}
