export interface AdminActivationChallenge {
  challengeToken: string;
  expiresAt: string;
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl?: string;
}

export interface AdminLoginChallenge {
  challengeToken: string;
  expiresAt: string;
}

export interface AdminSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  sessionExpiresAt: string;
}

export interface AdminPrincipal {
  userId: string;
  sessionId: string;
  accountType: 'ADMIN';
  status: 'ACTIVE';
  roles: string[];
  permissions: string[];
}

export interface PublicSession {
  sessionExpiresAt: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    retryAfterSeconds?: number;
  };
}
