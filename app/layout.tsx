import type { Metadata } from 'next';
import './globals.css';
import MaintenanceBanner from '@/components/layout/MaintenanceBanner';

export const metadata: Metadata = {
  title: 'Homepage3 - Void Dashboard',
  description: 'A premium, high-performance home server dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MaintenanceBanner />
        {children}
      </body>
    </html>
  );
}
