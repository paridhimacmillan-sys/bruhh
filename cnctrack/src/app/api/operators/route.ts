import { NextRequest, NextResponse } from 'next/server';
import { dbAddOperator, dbDeleteOperator, dbGetOperators } from '@/lib/neon';
import { requireAdmin, requireOrganizationId } from '@/lib/apiAuth';

export async function GET() {
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await dbGetOperators(organizationId));
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const name = String((await req.json())?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Operator name is required' }, { status: 400 });
  await dbAddOperator(name, organizationId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const name = String((await req.json())?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Operator name is required' }, { status: 400 });
  await dbDeleteOperator(name, organizationId);
  return NextResponse.json({ ok: true });
}
