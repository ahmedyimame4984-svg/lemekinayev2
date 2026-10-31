import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthenticationGuard } from './authentication.guard.js';
import type { AuthenticatedRequest, AuthPrincipal } from './auth.types.js';
import type { SessionService } from './session.service.js';

function createContext(
  request: Partial<AuthenticatedRequest>,
): ExecutionContext {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthenticationGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const sessions = { authenticateToken: vi.fn() };
  const guard = new AuthenticationGuard(
    reflector as unknown as Reflector,
    sessions as unknown as SessionService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('allows explicitly public routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).resolves.toBe(true);
    expect(sessions.authenticateToken).not.toHaveBeenCalled();
  });

  it('rejects a missing bearer token with a standardized error', async () => {
    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resolves and attaches an authenticated principal', async () => {
    const principal = { userId: 'user-1' } as AuthPrincipal;
    const request = { headers: { authorization: 'Bearer secret-token' } };
    sessions.authenticateToken.mockResolvedValue(principal);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(sessions.authenticateToken).toHaveBeenCalledWith('secret-token');
    expect(request).toHaveProperty('principal', principal);
  });

  it('rejects an unknown or expired session', async () => {
    sessions.authenticateToken.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer expired-token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
