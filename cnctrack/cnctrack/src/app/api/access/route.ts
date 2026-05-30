import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccessInfo } from '@/lib/access';

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const access = await getAccessInfo(email);
  return NextResponse.json(access);
}

