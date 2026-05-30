import { NextRequest, NextResponse } from 'next/server';
import { dbAddMachine } from '@/lib/neon';
import { requireAdmin } from '@/lib/apiAuth';
import { Machine } from '@/lib/mockData';

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const machine = (await req.json()) as Machine;
  await dbAddMachine(machine);
  return NextResponse.json({ ok: true });
}

