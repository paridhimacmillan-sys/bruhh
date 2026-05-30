import { auth } from '@/auth';
import { getAccessInfo } from '@/lib/access';

export async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const access = await getAccessInfo(email);
  return access.isAdmin;
}

