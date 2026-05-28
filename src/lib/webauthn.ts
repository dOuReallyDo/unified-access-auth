import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { siteUrl } from './env';

export function rpID() {
  return process.env.WEBAUTHN_RP_ID ?? new URL(siteUrl()).hostname;
}

export function rpName() {
  return process.env.WEBAUTHN_RP_NAME ?? 'Unified Access';
}

export function origin() {
  return siteUrl();
}

export function byteaToUint8Array(value: string | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value.startsWith('\\x')) return Uint8Array.from(Buffer.from(value.slice(2), 'hex'));
  return isoBase64URL.toBuffer(value);
}

export function uint8ArrayToBytea(value: Uint8Array): string {
  return `\\x${Buffer.from(value).toString('hex')}`;
}
