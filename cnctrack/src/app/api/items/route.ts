import { NextRequest, NextResponse } from 'next/server';
import { dbAddItem } from '@/lib/neon';
import { requireAdmin } from '@/lib/apiAuth';
import { Item } from '@/lib/mockData';

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const item = (await req.json()) as Item;
  await dbAddItem(item);
  return NextResponse.json({ ok: true });
}

