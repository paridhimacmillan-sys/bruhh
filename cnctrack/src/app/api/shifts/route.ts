import { NextRequest, NextResponse } from 'next/server';
import { dbAddShift, dbDeleteShift, dbGetShifts } from '@/lib/neon';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET() {
  return NextResponse.json(await dbGetShifts());
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json();
  const shift = {
    name: String(body?.name ?? '').trim(),
    startTime: String(body?.startTime ?? ''),
    endTime: String(body?.endTime ?? ''),
  };
  if (!shift.name || !/^\d{2}:\d{2}$/.test(shift.startTime) || !/^\d{2}:\d{2}$/.test(shift.endTime)) {
    return NextResponse.json({ error: 'Shift name, start time and end time are required' }, { status: 400 });
  }
  await dbAddShift(shift);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const name = String((await req.json())?.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Shift name is required' }, { status: 400 });
  }
  await dbDeleteShift(name);
  return NextResponse.json({ ok: true });
}
