import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AccountType } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard.js';
import type { AuthenticatedRequest, AuthPrincipal } from './auth.types.js';

function createContext(
  request: Partial<AuthenticatedRequest>,
): ExecutionContext {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new PermissionsGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'auth:required-permissions') return [];
      if (key === 'auth:required-account-types') return [];
      return false;
    });
  });

  it('allows authenticated routes without explicit permissions', () => {
    expect(guard.canActivate(createContext({ headers: {} }))).toBe(true);
  });

  it('allows every explicitly required permission', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'auth:required-permissions') {
        return ['admin.portal.access', 'catalog.manage'];
      }
      if (key === 'auth:required-account-types') return [];
      return false;
    });
    const principal = {
      permissions: ['admin.portal.access', 'catalog.manage'],
    } as AuthPrincipal;

    expect(guard.canActivate(createContext({ principal }))).toBe(true);
  });

  it('blocks a missing permission', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'auth:required-permissions') return ['admin.portal.access'];
      if (key === 'auth:required-account-types') return [];
      return false;
    });
    const principal = { permissions: [] } as unknown as AuthPrincipal;

    expect(() => guard.canActivate(createContext({ principal }))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a non-Admin account even if an Admin permission was assigned', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === 'auth:required-account-types') return [AccountType.ADMIN];
      if (key === 'auth:required-permissions') return ['admin.portal.access'];
      return false;
    });
    const principal = {
      accountType: AccountType.CUSTOMER,
      permissions: ['admin.portal.access'],
    } as AuthPrincipal;

    expect(() => guard.canActivate(createContext({ principal }))).toThrow(
      ForbiddenException,
    );
  });
});
