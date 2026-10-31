import type { ReactNode } from 'react';
import { AdminSessionGuard } from '@/components/admin-session';
import { AdminShell } from '@/components/admin-shell';

export default function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AdminSessionGuard>
      <AdminShell>{children}</AdminShell>
    </AdminSessionGuard>
  );
}
