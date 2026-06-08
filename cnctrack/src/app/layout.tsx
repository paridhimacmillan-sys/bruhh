import type { Metadata } from 'next';
import '@/styles/tailwind.css';
import '@/styles/index.css';
import StoreBootstrap from './StoreBootstrap';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: 'MachineTrack - Production Monitor',
  description: 'Shop floor production tracking and analytics for all machine types',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        {session?.user && <StoreBootstrap />}
        {children}
      </body>
    </html>
  );
}
