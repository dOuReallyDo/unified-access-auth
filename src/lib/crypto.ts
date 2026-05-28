import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqualHash(raw: string, expectedHash: string): boolean {
  const actual = Buffer.from(sha256(raw));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
