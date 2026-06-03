import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role === 'admin' ? 'admin' : 'employee';
  const organizationId = (session.user as { organizationId?: number | string | null }).organizationId ?? null;

  return NextResponse.json({
    authenticated: true,
    email,
    role,
    organizationId,
    isAdmin: role === 'admin',
  });
}
