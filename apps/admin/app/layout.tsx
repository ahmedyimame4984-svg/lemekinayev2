import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './admin-readable-density.css';

// Per-request rendering lets Next attach the CSP nonce to its framework scripts.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Lemekinaye Admin',
    template: '%s · Lemekinaye Admin',
  },
  description: 'Secure administration portal for the Lemekinaye marketplace.',
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
      <body>{children}</body>
    </html>
  );
}
