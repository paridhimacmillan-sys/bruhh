import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccessInfo } from '@/lib/access';

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email ?? null;
    const access = await getAccessInfo(email);
    return NextResponse.json(access);
  } catch (err) {
    console.error('[api/access] failed:', err);
    return NextResponse.json(
      {
        authenticated: false,
        email: null,
        role: null,
        isAdmin: false,
      },
      { status: 200 }
    );
  }
}
