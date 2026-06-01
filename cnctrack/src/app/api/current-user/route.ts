import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let role: 'admin' | 'employee' | null = null;
  try {
    const rows = await sql<{ role: string }[]>`SELECT role FROM app_users WHERE email = ${email} LIMIT 1`;
    role = rows?.[0]?.role === 'admin' ? 'admin' : 'employee';
  } catch {
    role = null;
  }

  return NextResponse.json({
    authenticated: true,
    email,
    role,
    isAdmin: role === 'admin',
  });
}

