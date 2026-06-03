import { NextRequest, NextResponse } from 'next/server';
import { dbGetEntries, dbUpsertEntries } from '@/lib/neon';
import { requireAdmin, requireOrganizationId } from '@/lib/apiAuth';
import { ProductionEntry } from '@/lib/mockData';

export async function GET(req: NextRequest) {
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const machineId = searchParams.get('machineId') ?? undefined;
  const shift = searchParams.get('shift') ?? undefined;
  const rows = await dbGetEntries({ dateFrom, dateTo, machineId, shift, organizationId });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entries = (await req.json()) as ProductionEntry[];
  await dbUpsertEntries(entries, organizationId);
  return NextResponse.json({ ok: true });
}
