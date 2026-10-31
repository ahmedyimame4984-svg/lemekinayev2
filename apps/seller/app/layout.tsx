import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SellerPortalFrame } from '@/components/seller-portal-frame';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Lemekinaye Seller',
    template: '%s · Lemekinaye Seller',
  },
  description: 'Secure Seller Portal for the Lemekinaye marketplace.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#15171b',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><SellerPortalFrame>{children}</SellerPortalFrame></body>
    </html>
  );
}
