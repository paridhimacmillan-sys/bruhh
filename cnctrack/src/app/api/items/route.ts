import { NextRequest, NextResponse } from 'next/server';
import { dbAddItem } from '@/lib/neon';
import { requireAdmin, requireOrganizationId } from '@/lib/apiAuth';
import { Item } from '@/lib/mockData';

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const organizationId = await requireOrganizationId();
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const item = (await req.json()) as Item;
  if (!item.itemName?.trim()) {
    return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
  }
  if (!Number.isFinite(Number(item.defaultRate)) || Number(item.defaultRate) <= 0) {
    return NextResponse.json({ error: 'Default production rate must be greater than 0' }, { status: 400 });
  }
  try {
    await dbAddItem(item, organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/items] Save failed:', error);
    return NextResponse.json({ error: 'Item could not be saved' }, { status: 500 });
  }
}
