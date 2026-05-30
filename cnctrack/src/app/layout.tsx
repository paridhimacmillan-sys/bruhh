import type { Metadata } from 'next';
import '@/styles/tailwind.css';
import '@/styles/index.css';
import StoreBootstrap from './StoreBootstrap';

export const metadata: Metadata = {
  title: 'MachineTrack - Production Monitor',
  description: 'Shop floor production tracking and analytics for all machine types',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreBootstrap />
        {children}
      </body>
    </html>
  );
}

