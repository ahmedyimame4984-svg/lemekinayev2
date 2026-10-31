import type { AccountStatus, AccountType } from '@prisma/client';
import type { Request } from 'express';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  accountType: AccountType;
  status: AccountStatus;
  roles: string[];
  permissions: string[];
}

export type AuthenticatedRequest = Request & {
  principal?: AuthPrincipal;
};
