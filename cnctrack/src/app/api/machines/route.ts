import { NextRequest, NextResponse } from 'next/server';
import { dbAddMachine } from '@/lib/neon';
import { requireAdmin, requireOrganizationId } from '@/lib/apiAuth';
import { Machine } from '@/lib/mockData';

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const machine = (await req.json()) as Machine;
  if (!machine.machineNumber?.trim() || !machine.machineType?.trim()) {
    return NextResponse.json({ error: 'Machine number and type are required' }, { status: 400 });
  }
  try {
    await dbAddMachine(machine, organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/machines] Save failed:', error);
    return NextResponse.json({ error: 'Machine could not be saved' }, { status: 500 });
  }
}
