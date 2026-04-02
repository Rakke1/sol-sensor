import type { SensorResponse } from '@/types';

/**
 * Verify an Ed25519 sensor data signature using the Web Crypto API.
 *
 * The sensor backend signs the canonical data hash (base64-encoded) with its
 * Ed25519 keypair and includes the raw signature and public key in the
 * `proof` field of every response.
 *
 * @returns true if the signature is valid, false otherwise.
 */
export async function verifySensorSignature(
  response: SensorResponse,
): Promise<boolean> {
  try {
    const { proof } = response;

    const messageBytes = base64ToBytes(proof.message);
    const signatureBytes = base58ToBytes(proof.signature);
    const pubkeyBytes = base58ToBytes(proof.sensorPubkey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(pubkeyBytes),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      cryptoKey,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(messageBytes),
    );
  } catch {
    return false;
  }
}

/** Convert a Uint8Array to a plain ArrayBuffer, safe for Web Crypto API calls. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Decode a base64 string to a Uint8Array using browser-native APIs. */
function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/**
 * Decode a base58-encoded string into a Uint8Array.
 * Uses a simple lookup-table implementation — no external dependency.
 */
function base58ToBytes(encoded: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = BigInt(58);

  let value = BigInt(0);
  for (const char of encoded) {
    const digit = ALPHABET.indexOf(char);
    if (digit === -1) throw new Error(`Invalid base58 character: ${char}`);
    value = value * BASE + BigInt(digit);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value >>= 8n;
  }

  for (const char of encoded) {
    if (char !== '1') break;
    bytes.unshift(0);
  }

  return new Uint8Array(bytes);
}

/**
 * Generate a random nonce as base58-encoded 32 random bytes.
 * Used as the nonce argument for the `pay_for_query` instruction.
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase58(bytes);
}

function bytesToBase58(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = BigInt(58);

  let value = BigInt(0);
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }

  let result = '';
  while (value > 0n) {
    result = ALPHABET[Number(value % BASE)] + result;
    value /= BASE;
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    result = '1' + result;
  }

  return result;
}
