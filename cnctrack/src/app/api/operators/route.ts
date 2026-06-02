import { NextRequest, NextResponse } from 'next/server';
import { dbAddOperator, dbDeleteOperator, dbGetOperators } from '@/lib/neon';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET() {
  return NextResponse.json(await dbGetOperators());
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const name = String((await req.json())?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Operator name is required' }, { status: 400 });
  await dbAddOperator(name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const name = String((await req.json())?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Operator name is required' }, { status: 400 });
  await dbDeleteOperator(name);
  return NextResponse.json({ ok: true });
}
