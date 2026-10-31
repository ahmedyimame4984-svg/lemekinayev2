import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
import { safeAdminReturnTo } from '@/lib/navigation';

export const metadata: Metadata = { title: 'Secure sign in' };

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const requested = (await searchParams).returnTo;
  const returnTo = safeAdminReturnTo(
    Array.isArray(requested) ? requested[0] : requested,
  );

  return (
    <AuthShell
      eyebrow="Admin Portal"
      title="Welcome back"
      description="Sign in with your privileged account. Your authenticator code is required next."
    >
      <LoginForm returnTo={returnTo} />
    </AuthShell>
  );
}
