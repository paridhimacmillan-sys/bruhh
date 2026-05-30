import { NextResponse } from 'next/server';
import { dbGetEntries, dbGetItems, dbGetMachines } from '@/lib/neon';

export async function GET() {
  try {
    const [machines, items, entries] = await Promise.all([
      dbGetMachines(),
      dbGetItems(),
      dbGetEntries(),
    ]);
    return NextResponse.json({ machines, items, entries });
  } catch {
    return NextResponse.json({ machines: [], items: [], entries: [] }, { status: 200 });
  }
}

