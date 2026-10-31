import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { validateEnvironment } from '../config/environment.js';
import {
  deriveMfaEncryptionKey,
  deriveSourceHashKey,
} from './auth-key-derivation.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_AAD = Buffer.from('lemekinaye:admin-mfa:v1');
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

export interface EncryptedMfaSecret {
  ciphertext: string;
  nonce: string;
  authTag: string;
}

@Injectable()
export class AdminAuthCrypto {
  private readonly encryptionKey: Buffer;
  private readonly sourceHashKey: Buffer;

  constructor() {
    const masterKey = validateEnvironment(process.env).authMfaEncryptionKey;
    this.encryptionKey = deriveMfaEncryptionKey(masterKey);
    this.sourceHashKey = deriveSourceHashKey(masterKey);
  }

  randomToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  hashSource(value: string): string {
    return createHmac('sha256', this.sourceHashKey)
      .update('lemekinaye:auth-source:v1\u0000')
      .update(value)
      .digest('hex');
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.derivePassword(password, salt);

    return [
      '',
      'scrypt',
      `n=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}`,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verifyPassword(
    password: string,
    encodedHash: string,
  ): Promise<boolean> {
    const parts = encodedHash.split('$');
    if (
      parts.length !== 5 ||
      parts[0] !== '' ||
      parts[1] !== 'scrypt' ||
      parts[2] !== `n=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}`
    ) {
      return false;
    }

    try {
      const salt = Buffer.from(parts[3] ?? '', 'base64url');
      const expected = Buffer.from(parts[4] ?? '', 'base64url');
      if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) {
        return false;
      }

      const actual = await this.derivePassword(password, salt);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  generateMfaSecret(): string {
    return this.encodeBase32(randomBytes(20));
  }

  encodeBase32(value: Buffer): string {
    let bits = 0;
    let accumulator = 0;
    let encoded = '';

    for (const byte of value) {
      accumulator = (accumulator << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        encoded += BASE32_ALPHABET[(accumulator >>> bits) & 31];
      }
    }

    if (bits > 0) {
      encoded += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
    }

    return encoded;
  }

  encryptMfaSecret(secret: string): EncryptedMfaSecret {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, nonce);
    cipher.setAAD(MFA_AAD);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64url'),
      nonce: nonce.toString('base64url'),
      authTag: cipher.getAuthTag().toString('base64url'),
    };
  }

  decryptMfaSecret(encrypted: EncryptedMfaSecret): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(encrypted.nonce, 'base64url'),
    );
    decipher.setAAD(MFA_AAD);
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  buildTotpUri(email: string, secret: string): string {
    const issuer = 'Lemekinaye Admin';
    const label = `${issuer}:${email}`;
    const parameters = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: String(TOTP_DIGITS),
      period: String(TOTP_PERIOD_SECONDS),
    });

    return `otpauth://totp/${encodeURIComponent(label)}?${parameters.toString()}`;
  }

  generateTotp(
    secret: string,
    timestampMilliseconds = Date.now(),
    digits = TOTP_DIGITS,
  ): string {
    const counter = BigInt(
      Math.floor(timestampMilliseconds / 1_000 / TOTP_PERIOD_SECONDS),
    );
    return this.generateHotp(secret, counter, digits);
  }

  verifyTotp(
    secret: string,
    code: string,
    lastAcceptedCounter: bigint | null,
    timestampMilliseconds = Date.now(),
  ): bigint | null {
    if (!/^\d{6}$/.test(code)) {
      return null;
    }

    const currentCounter = BigInt(
      Math.floor(timestampMilliseconds / 1_000 / TOTP_PERIOD_SECONDS),
    );
    const counters = [currentCounter, currentCounter - 1n, currentCounter + 1n];
    let matchedCounter: bigint | null = null;

    for (const counter of counters) {
      if (counter < 0n) continue;
      const expected = Buffer.from(
        this.generateHotp(secret, counter, TOTP_DIGITS),
      );
      const supplied = Buffer.from(code);
      if (timingSafeEqual(expected, supplied)) {
        matchedCounter = counter;
      }
    }

    if (
      matchedCounter === null ||
      (lastAcceptedCounter !== null && matchedCounter <= lastAcceptedCounter)
    ) {
      return null;
    }

    return matchedCounter;
  }

  private generateHotp(
    secret: string,
    counter: bigint,
    digits: number,
  ): string {
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(counter);
    const digest = createHmac('sha1', this.decodeBase32(secret))
      .update(counterBuffer)
      .digest();
    const offset = (digest.at(-1) ?? 0) & 0x0f;
    const binary =
      (((digest[offset] ?? 0) & 0x7f) << 24) |
      ((digest[offset + 1] ?? 0) << 16) |
      ((digest[offset + 2] ?? 0) << 8) |
      (digest[offset + 3] ?? 0);
    const modulus = 10 ** digits;

    return String(binary % modulus).padStart(digits, '0');
  }

  private decodeBase32(encoded: string): Buffer {
    let bits = 0;
    let accumulator = 0;
    const decoded: number[] = [];

    for (const character of encoded.toUpperCase().replace(/=+$/u, '')) {
      const value = BASE32_ALPHABET.indexOf(character);
      if (value < 0) {
        throw new Error('Invalid base32 value');
      }

      accumulator = (accumulator << 5) | value;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        decoded.push((accumulator >>> bits) & 0xff);
      }
    }

    return Buffer.from(decoded);
  }

  private derivePassword(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        SCRYPT_KEY_LENGTH,
        {
          N: SCRYPT_N,
          r: SCRYPT_R,
          p: SCRYPT_P,
          maxmem: 64 * 1024 * 1024,
        },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey);
        },
      );
    });
  }
}
