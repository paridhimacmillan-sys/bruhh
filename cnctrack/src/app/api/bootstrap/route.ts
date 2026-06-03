import { NextResponse } from 'next/server';
import { dbAdoptLegacyOrganizationData, dbGetEntries, dbGetItems, dbGetMachines } from '@/lib/neon';
import { requireOrganizationId } from '@/lib/apiAuth';

export async function GET() {
  const organizationId = await requireOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbAdoptLegacyOrganizationData(organizationId);
  const [machinesResult, itemsResult, entriesResult] = await Promise.allSettled([
    dbGetMachines(organizationId),
    dbGetItems(organizationId),
    dbGetEntries({ organizationId }),
  ]);

  return NextResponse.json({
    machines: machinesResult.status === 'fulfilled' ? machinesResult.value : [],
    items: itemsResult.status === 'fulfilled' ? itemsResult.value : [],
    entries: entriesResult.status === 'fulfilled' ? entriesResult.value : [],
    errors: {
      machines: machinesResult.status === 'rejected' ? String(machinesResult.reason) : null,
      items: itemsResult.status === 'rejected' ? String(itemsResult.reason) : null,
      entries: entriesResult.status === 'rejected' ? String(entriesResult.reason) : null,
    },
  });
}
