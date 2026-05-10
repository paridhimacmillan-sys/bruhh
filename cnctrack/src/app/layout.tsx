import type { Metadata } from 'next';
import '@/styles/tailwind.css';
import '@/styles/index.css';
import StoreBootstrap from './StoreBootstrap';

export const metadata: Metadata = {
  title: 'CNCTrack — Production Monitor',
  description: 'CNC shop floor production tracking and analytics',
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
