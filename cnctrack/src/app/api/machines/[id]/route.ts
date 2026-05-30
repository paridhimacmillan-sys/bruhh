import { NextRequest, NextResponse } from 'next/server';
import { dbDeleteMachine, dbUpdateMachine } from '@/lib/neon';
import { requireAdmin } from '@/lib/apiAuth';
import { Machine } from '@/lib/mockData';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const data = (await req.json()) as Partial<Machine>;
  await dbUpdateMachine(params.id, data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  await dbDeleteMachine(params.id);
  return NextResponse.json({ ok: true });
}

