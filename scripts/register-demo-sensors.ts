#!/usr/bin/env tsx
/**
 * Register Demo Sensors Script
 *
 * Registers 5 demo sensor stations in Almaty on-chain:
 *   - almaty-1: Downtown Center
 *   - almaty-2: Bostandyk District
 *   - almaty-3: Medeu Canyon
 *   - almaty-4: Alatau Foothills
 *   - almaty-5: Auezov Area
 *
 * Usage:
 *   npx tsx register-demo-sensors.ts
 */

import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getTransactionEncoder,
  generateKeyPairSigner,
  fetchEncodedAccount,
  address,
  type KeyPairSigner,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from '@solana/kit';

import {
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';

import { loadOrGenerateKeypair, saveMintAddress } from './lib/keypair.js';
import { createRpc, assertDevnet } from './lib/rpc.js';
import { deriveGlobalState, deriveSensorPool, deriveHardwareEntry, PROGRAM_ID } from './lib/pda.js';
import { buildRegisterSensorIx } from './lib/instructions.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEMO_SENSORS = [
  { id: 'almaty-1', name: 'Downtown Center', lat: 43.238, lng: 76.945 },
  { id: 'almaty-2', name: 'Bostandyk District', lat: 43.27, lng: 76.917 },
  { id: 'almaty-3', name: 'Medeu Canyon', lat: 43.209, lng: 76.97 },
  { id: 'almaty-4', name: 'Alatau Foothills', lat: 43.19, lng: 76.93 },
  { id: 'almaty-5', name: 'Auezov Area', lat: 43.255, lng: 76.9 },
] as const;

const MODEL_ID = 3; // Mock Dev Sensor (5 USDC, 50 tokens)
const txEncoder = getTransactionEncoder();

async function sendTx(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  instructions: Parameters<typeof appendTransactionMessageInstructions>[0],
): Promise<Signature> {
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

  // Wait for confirmation
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
    await sleep(2_000);
  }
  throw new Error(`Transaction not confirmed within 60s: ${sig}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function saveSensorKeypair(sensorId: string, address: string): void {
  const keysDir = path.join(__dirname, 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  const filePath = path.join(keysDir, `demo-${sensorId}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ address, sensorId }, null, 2));
  console.log(`    Saved keypair to: ${filePath}`);
}

async function registerSensor(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  usdcMint: string,
  poolMint: string,
  poolVault: string,
  sensor: { id: string; name: string },
  sensorKeypair: KeyPairSigner,
): Promise<{ sensorPubkey: string; hardwareEntryPda: string; txSig: Signature }> {
  const [hardwareEntryPda] = await deriveHardwareEntry(sensorKeypair.address);

  // Check if already registered
  const hwAccount = await fetchEncodedAccount(rpc, hardwareEntryPda);
  if (hwAccount.exists) {
    console.log(`  ✓ ${sensor.name} already registered`);
    return { sensorPubkey: sensorKeypair.address, hardwareEntryPda, txSig: '' as Signature };
  }

  const [globalStatePda] = await deriveGlobalState();
  const [sensorPoolPda] = await deriveSensorPool();

  // Owner's pool token ATA (Token2022 mint)
  const [ownerPoolTokenAta] = await findAssociatedTokenPda({
    mint: address(poolMint),
    owner: payer.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Ensure the ATA exists
  const createPoolAtaIx = getCreateAssociatedTokenIdempotentInstruction({
    payer,
    owner: payer.address,
    mint: address(poolMint),
    ata: ownerPoolTokenAta,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Owner's USDC ATA
  const [ownerUsdcAta] = await findAssociatedTokenPda({
    mint: address(usdcMint),
    owner: payer.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const registerIx = buildRegisterSensorIx(
    {
      owner: payer,
      sensorPubkey: sensorKeypair.address,
      globalState: globalStatePda,
      sensorPool: sensorPoolPda,
      hardwareEntry: hardwareEntryPda,
      mint: address(poolMint),
      ownerTokenAccount: ownerPoolTokenAta,
      usdcMint: address(usdcMint),
      ownerUsdcAccount: ownerUsdcAta,
      poolVault: address(poolVault),
    },
    MODEL_ID,
  );

  const sig = await sendTx(rpc, payer, [createPoolAtaIx, registerIx]);
  console.log(`  ✓ Registered ${sensor.name} (${sensor.id})`);
  console.log(`    Sensor pubkey: ${sensorKeypair.address}`);
  console.log(`    HardwareEntry: ${hardwareEntryPda}`);
  console.log(`    Tx: ${sig}`);

  return { sensorPubkey: sensorKeypair.address, hardwareEntryPda, txSig: sig };
}

async function main(): Promise<void> {
  console.log('\n🎯 Demo Sensor Registration\n');
  console.log(`  Program ID: ${PROGRAM_ID}`);
  console.log(`  Registering ${DEMO_SENSORS.length} demo sensors...`);

  // Setup RPC & payer
  const rpc = createRpc();
  console.log('\n[1/2] Checking cluster...');
  await assertDevnet(rpc);
  console.log('  ✓ Connected to Solana devnet');

  console.log('\n[2/2] Loading payer & registering sensors...');
  const { signer: payer } = await loadOrGenerateKeypair('payer');
  console.log(`  ✓ Payer: ${payer.address}`);

  // Get pool info
  const [sensorPoolPda] = await deriveSensorPool();
  const poolAccount = await fetchEncodedAccount(rpc, sensorPoolPda);
  if (!poolAccount.exists) {
    throw new Error('SensorPool not found. Run bootstrap-devnet.ts first.');
  }

  // Parse mint (bytes 8..40) and vault (bytes 40..72) from SensorPool data
  const { getAddressDecoder } = await import('@solana/kit');
  const addrDecoder = getAddressDecoder();
  const data = new Uint8Array(poolAccount.data);
  const poolMint = addrDecoder.decode(data.slice(8, 40));
  const poolVault = addrDecoder.decode(data.slice(40, 72));

  // Get USDC mint
  const usdcMint = await loadMintAddress('usdc-mint');

  console.log(`  Pool mint: ${poolMint}`);
  console.log(`  Pool vault: ${poolVault}`);
  console.log(`  USDC mint: ${usdcMint}\n`);

  const results: Array<{
    sensorId: string;
    name: string;
    sensorPubkey: string;
    hardwareEntryPda: string;
    txSig: Signature;
  }> = [];

  for (const sensor of DEMO_SENSORS) {
    console.log(`\n  Registering: ${sensor.name}`);
    
    // Generate/load sensor keypair
    const sensorKeypair = await generateKeyPairSigner();
    console.log(`    Generated sensor keypair: ${sensorKeypair.address}`);

    // Register the sensor
    const { sensorPubkey, hardwareEntryPda, txSig } = await registerSensor(
      rpc,
      payer,
      usdcMint,
      poolMint,
      poolVault,
      sensor,
      sensorKeypair,
    );

    // Save the keypair
    saveSensorKeypair(sensor.id, sensorKeypair.address);

    results.push({
      sensorId: sensor.id,
      name: sensor.name,
      sensorPubkey,
      hardwareEntryPda,
      txSig,
    });

    // Small delay between registrations
    await sleep(2_000);
  }

  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('  REGISTRATION COMPLETE');
  console.log('═'.repeat(70));

  console.log('\n  Registered Demo Sensors:');
  for (const result of results) {
    console.log(`\n    ${result.name} (${result.sensorId})`);
    console.log(`      Pubkey:  ${result.sensorPubkey}`);
    console.log(`      PDA:     ${result.hardwareEntryPda}`);
    if (result.txSig) {
      console.log(`      Tx:      ${result.txSig}`);
    }
  }

  console.log('\n  Keypair files saved to: ./keys/demo-almaty-*.json\n');
}

function loadMintAddress(name: string): string {
  const keysDir = path.join(__dirname, 'keys');
  const filePath = path.join(keysDir, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Mint address file not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.address;
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
