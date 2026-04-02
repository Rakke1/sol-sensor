import {
  createKeyPairSignerFromBytes,
  fetchEncodedAccount,
  address,
  assertAccountExists,
} from '@solana/kit';
import type { Address, KeyPairSigner } from '@solana/kit';
import { rpc, COSIGNER_KEYPAIR_PATH, loadKeypairBytes } from '../config';

export type { Address, KeyPairSigner };

/** Lazy-loaded co-signer keypair. */
let cosignerCache: KeyPairSigner | null = null;

/**
 * Load (or return cached) co-signer KeyPairSigner.
 * Returns null if the keypair file is missing — server will still start
 * but receipt consumption will be unavailable.
 */
export async function getCosigner(): Promise<KeyPairSigner | null> {
  if (cosignerCache) return cosignerCache;
  const bytes = loadKeypairBytes(COSIGNER_KEYPAIR_PATH);
  if (!bytes) {
    console.warn(
      '[Solana] Co-signer keypair not found — receipt consumption disabled.',
    );
    return null;
  }
  cosignerCache = await createKeyPairSignerFromBytes(bytes);
  return cosignerCache;
}

/**
 * Fetch and decode a QueryReceipt PDA.
 * Returns the raw account data so callers can decode with the Anchor IDL codec.
 * Throws SOLANA_ERROR__ACCOUNT_NOT_FOUND if the PDA does not exist.
 */
export async function fetchReceipt(receiptPda: string): Promise<Uint8Array> {
  const receiptAddress: Address = address(receiptPda);
  const account = await fetchEncodedAccount(rpc, receiptAddress);
  assertAccountExists(account);
  return account.data as Uint8Array;
}

/**
 * Decode the QueryReceipt account data (8-byte discriminator + fields).
 *
 * Layout (matching the Anchor struct):
 *   [0..8]   discriminator
 *   [8..40]  sensor_id (Pubkey, 32 bytes)
 *   [40..72] payer (Pubkey, 32 bytes)
 *   [72..80] amount (u64, LE)
 *   [80]     consumed (bool)
 *   [81..89] created_at (i64, LE)
 *   [89..97] expiry_slot (u64, LE)
 *   [97]     bump (u8)
 */
export interface QueryReceiptData {
  sensorId: string;
  payer: string;
  amount: bigint;
  consumed: boolean;
  createdAt: bigint;
  expirySlot: bigint;
  bump: number;
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) break;
    leadingZeros++;
  }
  const digits: number[] = [0];
  for (let i = leadingZeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return (
    BASE58_ALPHABET[0].repeat(leadingZeros) +
    digits
      .reverse()
      .map((d) => BASE58_ALPHABET[d])
      .join('')
  );
}

export function decodeQueryReceipt(data: Uint8Array): QueryReceiptData {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sensorId = encodeBase58(data.slice(8, 40));
  const payer = encodeBase58(data.slice(40, 72));
  const amount = view.getBigUint64(72, true);
  const consumed = data[80] === 1;
  const createdAt = view.getBigInt64(81, true);
  const expirySlot = view.getBigUint64(89, true);
  const bump = data[97];
  return { sensorId, payer, amount, consumed, createdAt, expirySlot, bump };
}
