import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccessInfo } from '@/lib/access';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const access = await getAccessInfo(session.user.email);
    return NextResponse.json(access, { status: 200 });
  } catch (err) {
    console.error('[api/current-user] failed:', err);
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

