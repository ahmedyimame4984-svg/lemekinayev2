import type { Metadata } from 'next';
import { ActivationForm } from '@/components/activation-form';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Activate Admin account' };

export default function ActivatePage() {
  return (
    <AuthShell
      eyebrow="First-time setup"
      title="Activate your Admin account"
      description="Use your one-time invitation, choose a strong password, and connect an authenticator app."
    >
      <ActivationForm />
    </AuthShell>
  );
}
