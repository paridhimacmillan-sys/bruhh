import { NextRequest, NextResponse } from 'next/server';
import { dbDeleteItem, dbUpdateItem } from '@/lib/neon';
import { requireAdmin } from '@/lib/apiAuth';
import { Item } from '@/lib/mockData';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const data = (await req.json()) as Partial<Item>;
  await dbUpdateItem(params.id, data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  await dbDeleteItem(params.id);
  return NextResponse.json({ ok: true });
}

