export const dynamic = 'force-dynamic';
import AppLayout from '@/components/AppLayout';
import UsersClient from './UsersClient';

export default function UsersPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <UsersClient />
      </div>
    </AppLayout>
  );
}
