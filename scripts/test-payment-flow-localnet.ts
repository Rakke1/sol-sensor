#!/usr/bin/env tsx
/**
 * End-to-end test for the backend payment flow on localnet.
 *
 * 1. Sends pay_for_query on-chain (creates a receipt PDA)
 * 2. Calls GET /api/v1/sensors/AQI with receipt headers
 * 3. Verifies 200 + sensor data returned
 * 4. Backend fires consume_receipt in the background
 *
 * Usage:
 *   npx tsx test-payment-flow-localnet.ts [backend-url]
 * 
 * Note: Requires solana-test-validator running and bootstrap-localnet.ts executed first.
 */

import * as crypto from 'node:crypto';
import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getTransactionEncoder,
  getProgramDerivedAddress,
  getAddressEncoder,
  AccountRole,
  address,
  type KeyPairSigner,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
  type Address,
  type Instruction,
  type AccountMeta,
  type AccountSignerMeta,
} from '@solana/kit';

import { findAssociatedTokenPda, TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';

import { loadOrGenerateKeypair, loadMintAddress } from './lib/keypair.js';
import { createLocalnetRpc, assertLocalnet } from './lib/rpc.js';
import { deriveGlobalState, deriveSensorPool, deriveHardwareEntry, PROGRAM_ID } from './lib/pda.js';

const BACKEND_URL = process.argv[2] || 'http://localhost:3001';
const QUERY_AMOUNT = 50_000n; // 0.05 USDC (6 decimals)

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
const CLOCK_SYSVAR = 'SysvarC1ock11111111111111111111111111111111' as Address;

const txEncoder = getTransactionEncoder();
const addrEncoder = getAddressEncoder();

function anchorDiscriminator(name: string): Uint8Array {
  return new Uint8Array(
    crypto.createHash('sha256').update(`global:${name}`).digest().subarray(0, 8),
  );
}

function encodeU64LE(value: bigint): Uint8Array {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);

  return new Uint8Array(buf);
}

type AnyAccountMeta = AccountMeta | AccountSignerMeta;

function wSigner(signer: KeyPairSigner): AccountSignerMeta {
  return { address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer };
}
function w(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.WRITABLE };
}
function r(addr: Address): AccountMeta {
  return { address: addr, role: AccountRole.READONLY };
}

function buildPayForQueryIx(
  payer: KeyPairSigner,
  globalState: Address,
  sensorPool: Address,
  hardwareEntry: Address,
  hardwareOwnerUsdc: Address,
  payerUsdc: Address,
  poolVault: Address,
  usdcMint: Address,
  receiptPda: Address,
  nonce: Uint8Array,
  amount: bigint,
): Instruction<string, readonly AnyAccountMeta[]> {
  const disc = anchorDiscriminator('pay_for_query');
  const data = new Uint8Array(8 + 32 + 8);
  data.set(disc, 0);
  data.set(nonce, 8);
  data.set(encodeU64LE(amount), 40);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      wSigner(payer),
      w(globalState),
      w(sensorPool),
      r(hardwareEntry),
      w(hardwareOwnerUsdc),
      w(payerUsdc),
      w(poolVault),
      r(usdcMint),
      w(receiptPda),
      r(TOKEN_2022_PROGRAM),
      r(SYSTEM_PROGRAM),
      r(CLOCK_SYSVAR),
    ],
    data,
  };
}

async function sendTx(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  instructions: Parameters<typeof appendTransactionMessageInstructions>[0],
): Promise<string> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
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

  const startTime = Date.now();
  while (Date.now() - startTime < 60_000) {
    const status = await rpc.getSignatureStatuses([sig]).send();
    const result = status.value[0];
    if (result?.confirmationStatus === 'confirmed' || result?.confirmationStatus === 'finalized') {
      return sig;
    }
    if (result?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(result.err)}`);
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Transaction not confirmed within 60s: ${sig}`);
}

async function main(): Promise<void> {
  console.log('\n🧪 SolSensor Payment Flow E2E Test (Localnet)\n');
  console.log(`  Backend: ${BACKEND_URL}`);
  console.log(`  Program: ${PROGRAM_ID}`);

  const rpc = createLocalnetRpc();
  await assertLocalnet(rpc);

  // Load payer
  const { signer: payer } = await loadOrGenerateKeypair('payer');
  console.log(`  Payer: ${payer.address}`);

  // Load addresses
  const usdcMintStr = loadMintAddress('usdc-mint');
  if (!usdcMintStr) {
    throw new Error('No USDC mint found — run bootstrap-localnet.ts first');
  }
  const usdcMint = address(usdcMintStr);

  // Load sensor keypair to get sensor pubkey
  const { signer: sensor } = await loadOrGenerateKeypair('sensor');
  const sensorPubkey = sensor.address;

  // Derive PDAs
  const [globalStatePda] = await deriveGlobalState();
  const [sensorPoolPda] = await deriveSensorPool();
  const [hardwareEntryPda] = await deriveHardwareEntry(sensorPubkey);

  // Derive ATAs
  const [payerUsdcAta] = await findAssociatedTokenPda({
    mint: usdcMint,
    owner: payer.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  const [poolVaultAta] = await findAssociatedTokenPda({
    mint: usdcMint,
    owner: sensorPoolPda,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  const [hardwareOwnerUsdcAta] = await findAssociatedTokenPda({
    mint: usdcMint,
    owner: payer.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Generate random nonce
  const nonce = new Uint8Array(crypto.randomBytes(32));
  const nonceB64 = Buffer.from(nonce).toString('base64url');

  // Derive receipt PDA
  const [receiptPda] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [Buffer.from('receipt'), nonce],
  });

  console.log('\n── Step 1: pay_for_query on-chain ──');
  console.log(`  Receipt PDA: ${receiptPda}`);
  console.log(`  Nonce (b64url): ${nonceB64}`);
  console.log(`  Amount: ${QUERY_AMOUNT} micro-USDC`);

  const ix = buildPayForQueryIx(
    payer,
    globalStatePda,
    sensorPoolPda,
    hardwareEntryPda,
    hardwareOwnerUsdcAta,
    payerUsdcAta,
    poolVaultAta,
    usdcMint,
    receiptPda,
    nonce,
    QUERY_AMOUNT,
  );

  const sig = await sendTx(rpc, payer, [ix]);
  console.log(`  ✓ Transaction confirmed: ${sig}`);

  // Step 2: Call backend
  console.log('\n── Step 2: GET /api/v1/sensors/AQI (with receipt) ──');
  const url = `${BACKEND_URL}/api/v1/sensors/AQI`;
  console.log(`  URL: ${url}`);
  console.log(`  x-query-receipt: ${receiptPda}`);
  console.log(`  x-query-nonce: ${nonceB64}`);

  const resp = await fetch(url, {
    headers: {
      'x-query-receipt': receiptPda,
      'x-query-nonce': nonceB64,
    },
  });

  console.log(`  Status: ${resp.status}`);
  const body = await resp.json();
  console.log(`  Response:`, JSON.stringify(body, null, 2));

  if (resp.status === 200 && body.data && body.proof) {
    console.log('\n✅ E2E test PASSED — got signed sensor data!');
    console.log(`   Sensor type: ${body.data.sensorType}`);
    console.log(`   AQI: ${body.data.aqi}`);
    console.log(`   Signed by: ${body.proof.sensorPubkey}`);
  } else {
    console.log(`\n❌ E2E test FAILED — expected 200 with data+proof`);
    process.exit(1);
  }

  // Give the backend a moment to fire consume_receipt
  console.log('\n── Step 3: Waiting 5s for consume_receipt ──');
  await new Promise((r) => setTimeout(r, 5_000));
  console.log('  Check backend logs for [Consume] messages.');
  console.log('\nDone! 🎉\n');
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
