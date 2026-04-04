import * as crypto from 'crypto';
import {
  createKeyPairSignerFromBytes,
  fetchEncodedAccount,
  address,
  assertAccountExists,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getTransactionEncoder,
  AccountRole,
} from '@solana/kit';
import type {
  Address,
  KeyPairSigner,
  Instruction,
  AccountMeta,
  AccountSignerMeta,
  Signature,
} from '@solana/kit';
import { rpc, COSIGNER_KEYPAIR_PATH, PROGRAM_ID, loadKeypairBytes } from '../config';
import { deriveGlobalState, deriveReceiptPda } from './pda';
import { encodeBase58 } from '../utils/base58';

export type { Address, KeyPairSigner };
export { encodeBase58 };

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
 * Layout (114 bytes, matching the Anchor struct):
 *   [0..8]     discriminator
 *   [8..40]    sensor_id (Pubkey, 32 bytes)
 *   [40..72]   payer (Pubkey, 32 bytes)
 *   [72..80]   amount (u64, LE)
 *   [80..88]   pool_share (u64, LE)
 *   [88..96]   total_supply_at_payment (u64, LE)
 *   [96]       consumed (bool)
 *   [97..105]  created_at (i64, LE)
 *   [105..113] expiry_slot (u64, LE)
 *   [113]      bump (u8)
 */
export interface QueryReceiptData {
  sensorId: string;
  payer: string;
  amount: bigint;
  poolShare: bigint;
  totalSupplyAtPayment: bigint;
  consumed: boolean;
  createdAt: bigint;
  expirySlot: bigint;
  bump: number;
}

const QUERY_RECEIPT_SIZE = 114;

const QUERY_RECEIPT_DISCRIMINATOR = new Uint8Array(
  crypto.createHash('sha256').update('account:QueryReceipt').digest().subarray(0, 8),
);

export function decodeQueryReceipt(data: Uint8Array): QueryReceiptData {
  if (data.length < QUERY_RECEIPT_SIZE) {
    throw new Error(
      `Invalid receipt data: expected at least ${QUERY_RECEIPT_SIZE} bytes, got ${data.length}`,
    );
  }

  for (let i = 0; i < 8; i++) {
    if (data[i] !== QUERY_RECEIPT_DISCRIMINATOR[i]) {
      throw new Error('Invalid receipt data: Anchor discriminator mismatch');
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sensorId = encodeBase58(data.slice(8, 40));
  const payer = encodeBase58(data.slice(40, 72));
  const amount = view.getBigUint64(72, true);
  const poolShare = view.getBigUint64(80, true);
  const totalSupplyAtPayment = view.getBigUint64(88, true);
  const consumed = data[96] === 1;
  const createdAt = view.getBigInt64(97, true);
  const expirySlot = view.getBigUint64(105, true);
  const bump = data[113];

  return {
    sensorId,
    payer,
    amount,
    poolShare,
    totalSupplyAtPayment,
    consumed,
    createdAt,
    expirySlot,
    bump,
  };
}

// ---------------------------------------------------------------------------
// consume_receipt instruction builder + sender
// ---------------------------------------------------------------------------

const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const CLOCK_SYSVAR = 'SysvarC1ock11111111111111111111111111111111' as Address;

const CONSUME_RECEIPT_DISCRIMINATOR = new Uint8Array(
  crypto.createHash('sha256').update('global:consume_receipt').digest().subarray(0, 8),
);

type AnyAccountMeta = AccountMeta | AccountSignerMeta;

function buildConsumeReceiptIx(
  cosigner: KeyPairSigner,
  globalState: Address,
  receiptPda: Address,
  payerAddress: Address,
  nonce: Uint8Array,
): Instruction<string, readonly AnyAccountMeta[]> {
  const data = new Uint8Array(8 + 32);
  data.set(CONSUME_RECEIPT_DISCRIMINATOR, 0);
  data.set(nonce, 8);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: cosigner.address, role: AccountRole.READONLY_SIGNER, signer: cosigner },
      { address: globalState, role: AccountRole.READONLY },
      { address: receiptPda, role: AccountRole.WRITABLE },
      { address: payerAddress, role: AccountRole.WRITABLE },
      { address: CLOCK_SYSVAR, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data,
  };
}

const txEncoder = getTransactionEncoder();

/**
 * Build and send a consume_receipt transaction.
 * Fire-and-forget: logs result, never throws.
 */
export async function sendConsumeReceipt(
  receiptPdaStr: string,
  nonce: Uint8Array,
  payerAddressStr: string,
): Promise<void> {
  try {
    const cosigner = await getCosigner();
    if (!cosigner) {
      console.warn('[Consume] Skipped — no co-signer keypair loaded');

      return;
    }

    const globalState = await deriveGlobalState();
    const receiptAddr = address(receiptPdaStr);
    const payerAddr = address(payerAddressStr);

    const ix = buildConsumeReceiptIx(
      cosigner,
      globalState,
      receiptAddr,
      payerAddr,
      nonce,
    );

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(cosigner, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions([ix], m),
    );

    const signedTx = await signTransactionMessageWithSigners(msg);
    const sig: Signature = getSignatureFromTransaction(signedTx);
    const wireBytes = txEncoder.encode(signedTx);
    const base64Tx = Buffer.from(wireBytes).toString('base64');

    await rpc
      .sendTransaction(base64Tx as Parameters<typeof rpc.sendTransaction>[0], {
        encoding: 'base64',
        skipPreflight: false,
      } as Parameters<typeof rpc.sendTransaction>[1])
      .send();

    console.log(`[Consume] Receipt consumed: ${receiptPdaStr} (sig: ${sig})`);
  } catch (err) {
    console.warn(`[Consume] Failed to consume receipt ${receiptPdaStr}:`, err);
  }
}
