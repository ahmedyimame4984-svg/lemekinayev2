import { hkdfSync } from 'node:crypto';

const AUTH_KEY_SALT = Buffer.from('lemekinaye:auth:v1');

export function deriveMfaEncryptionKey(masterKey: Buffer): Buffer {
  return deriveKey(masterKey, 'admin-mfa-encryption');
}

export function deriveSourceHashKey(masterKey: Buffer): Buffer {
  return deriveKey(masterKey, 'source-hash');
}

function deriveKey(masterKey: Buffer, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      masterKey,
      AUTH_KEY_SALT,
      Buffer.from(`lemekinaye:${purpose}:v1`),
      32,
    ),
  );
}
