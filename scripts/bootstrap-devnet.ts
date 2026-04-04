#!/usr/bin/env tsx
/**
 * SolSensor Devnet Bootstrap Script
 *
 * One-command setup for the full devnet environment:
 *   npx tsx bootstrap-devnet.ts
 *
 * Creates mock USDC, initializes pool, registers test sensor,
 * generates keypairs, and outputs .env-ready configuration.
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
  lamports,
  address,
  type KeyPairSigner,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from '@solana/kit';

import {
  getCreateAccountInstruction,
} from '@solana-program/system';

import {
  getMintSize,
  getInitializeMint2Instruction,
  getMintToInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';

import { loadOrGenerateKeypair, saveMintAddress, loadMintAddress } from './lib/keypair.js';
import { createRpc, assertDevnet, ensureSolBalance } from './lib/rpc.js';
import { deriveGlobalState, deriveSensorPool, deriveExtraAccountMetaList, deriveHardwareEntry, PROGRAM_ID } from './lib/pda.js';
import { buildInitializePoolIx, buildRegisterSensorIx, TOKEN_2022_PROGRAM, ASSOCIATED_TOKEN_PROGRAM, SYSTEM_PROGRAM } from './lib/instructions.js';

const MAX_SUPPLY = 10_000_000n;
const MOCK_USDC_AMOUNT = 10_000_000_000n; // 10,000 USDC (6 decimals)
const MODEL_ID = 3; // Mock Dev Sensor

const txEncoder = getTransactionEncoder();

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

interface BootstrapResult {
  payerAddress: string;
  usdcMint: string;
  poolMint: string;
  globalStatePda: string;
  sensorPoolPda: string;
  poolVault: string;
  sensorPubkey: string;
  cosignerPubkey: string;
  hardwareEntryPda: string;
  sensorKeypairPath: string;
  cosignerKeypairPath: string;
}

async function main(): Promise<void> {
  console.log('\n🔧 SolSensor Devnet Bootstrap\n');
  console.log(`  Program ID: ${PROGRAM_ID}`);

  // ─── Step 0: Setup RPC & payer ───
  const rpc = createRpc();
  console.log('\n[1/6] Checking cluster...');
  await assertDevnet(rpc);
  console.log('  ✓ Connected to Solana devnet');

  console.log('\n[2/6] Loading payer keypair...');
  const { signer: payer, created: payerCreated } = await loadOrGenerateKeypair('payer');
  console.log(`  ${payerCreated ? '✓ Generated' : '✓ Loaded'} payer: ${payer.address}`);

  await ensureSolBalance(rpc, payer, {
    minLamports: 2_000_000_000n,
    airdropLamports: 2_000_000_000n,
  });

  // ─── Step 1: Create mock USDC ───
  console.log('\n[3/6] Setting up mock USDC...');
  const usdcMintAddress = await setupMockUsdc(rpc, payer);

  // ─── Step 2: Initialize pool ───
  console.log('\n[4/6] Initializing sensor pool...');
  const { poolMint, poolVault } = await initializePool(rpc, payer, usdcMintAddress);

  // ─── Step 3: Register test sensor ───
  console.log('\n[5/6] Registering test sensor...');
  const { sensorPubkey, hardwareEntryPda } = await registerTestSensor(
    rpc, payer, usdcMintAddress, poolMint, poolVault,
  );

  // ─── Step 4: Generate cosigner keypair ───
  console.log('\n[6/6] Setting up cosigner keypair...');
  const { signer: cosigner, created: cosignerCreated } = await loadOrGenerateKeypair('cosigner');
  console.log(`  ${cosignerCreated ? '✓ Generated' : '✓ Loaded'} cosigner: ${cosigner.address}`);

  // ─── Summary ───
  const [globalStatePda] = await deriveGlobalState();
  const [sensorPoolPda] = await deriveSensorPool();

  const result: BootstrapResult = {
    payerAddress: payer.address,
    usdcMint: usdcMintAddress,
    poolMint,
    globalStatePda,
    sensorPoolPda,
    poolVault,
    sensorPubkey,
    cosignerPubkey: cosigner.address,
    hardwareEntryPda,
    sensorKeypairPath: './scripts/keys/sensor.json',
    cosignerKeypairPath: './scripts/keys/cosigner.json',
  };

  printSummary(result);
}

async function setupMockUsdc(rpc: Rpc<SolanaRpcApi>, payer: KeyPairSigner): Promise<string> {
  const existingAddress = loadMintAddress('usdc-mint');
  if (existingAddress) {
    const account = await fetchEncodedAccount(rpc, address(existingAddress));
    if (account.exists) {
      console.log(`  ✓ Mock USDC already exists: ${existingAddress}`);

      // Ensure payer has an ATA with tokens
      await ensurePayerHasUsdc(rpc, payer, address(existingAddress));

      return existingAddress;
    }
    console.log('  ⚠ Saved USDC address not found on-chain, creating new one...');
  }

  const mintKeypair = await generateKeyPairSigner();
  const mintSize = getMintSize();
  const rentLamports = await rpc.getMinimumBalanceForRentExemption(BigInt(mintSize)).send();

  const createAccountIx = getCreateAccountInstruction({
    payer,
    newAccount: mintKeypair,
    lamports: lamports(rentLamports),
    space: mintSize,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const initMintIx = getInitializeMint2Instruction({
    mint: mintKeypair.address,
    decimals: 6,
    mintAuthority: payer.address,
  });

  await sendTx(rpc, payer, [createAccountIx, initMintIx]);
  console.log(`  ✓ Created mock USDC mint: ${mintKeypair.address}`);
  saveMintAddress('usdc-mint', mintKeypair.address);

  await ensurePayerHasUsdc(rpc, payer, mintKeypair.address);

  return mintKeypair.address;
}

async function ensurePayerHasUsdc(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  usdcMint: ReturnType<typeof address>,
): Promise<void> {
  const [ata] = await findAssociatedTokenPda({
    mint: usdcMint,
    owner: payer.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const ataAccount = await fetchEncodedAccount(rpc, ata);
  if (ataAccount.exists) {
    console.log(`  ✓ Payer USDC ATA exists: ${ata}`);

    return;
  }

  const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
    payer,
    owner: payer.address,
    mint: usdcMint,
    ata,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const mintToIx = getMintToInstruction({
    mint: usdcMint,
    token: ata,
    mintAuthority: payer,
    amount: MOCK_USDC_AMOUNT,
  });

  await sendTx(rpc, payer, [createAtaIx, mintToIx]);
  console.log(`  ✓ Minted ${Number(MOCK_USDC_AMOUNT) / 1e6} USDC to payer ATA: ${ata}`);
}

async function initializePool(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  usdcMint: string,
): Promise<{ poolMint: string; poolVault: string }> {
  const [globalStatePda] = await deriveGlobalState();

  const globalAccount = await fetchEncodedAccount(rpc, globalStatePda);
  if (globalAccount.exists) {
    console.log('  ✓ Pool already initialized');
    // Read pool to get mint and vault
    const [sensorPoolPda] = await deriveSensorPool();
    const poolAccount = await fetchEncodedAccount(rpc, sensorPoolPda);
    if (!poolAccount.exists) {
      throw new Error('GlobalState exists but SensorPool not found');
    }
    // Parse mint (bytes 8..40) and vault (bytes 40..72) from SensorPool data
    const { getAddressDecoder } = await import('@solana/kit');
    const addrDecoder = getAddressDecoder();
    const data = new Uint8Array(poolAccount.data);
    const poolMint = addrDecoder.decode(data.slice(8, 40));
    const poolVault = addrDecoder.decode(data.slice(40, 72));

    return { poolMint, poolVault };
  }

  // Generate a fresh keypair for the pool Token-2022 mint
  const mintKeypair = await generateKeyPairSigner();

  const [sensorPoolPda] = await deriveSensorPool();
  const [extraAccountMetaListPda] = await deriveExtraAccountMetaList(mintKeypair.address);

  // Derive the pool vault ATA (USDC ATA owned by sensorPool, under Token2022)
  const [poolVaultAta] = await findAssociatedTokenPda({
    mint: address(usdcMint),
    owner: sensorPoolPda,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const ix = buildInitializePoolIx(
    {
      admin: payer,
      globalState: globalStatePda,
      sensorPool: sensorPoolPda,
      mint: mintKeypair,
      poolVault: poolVaultAta,
      usdcMint: address(usdcMint),
      extraAccountMetaList: extraAccountMetaListPda,
    },
    MAX_SUPPLY,
  );

  const sig = await sendTx(rpc, payer, [ix]);
  console.log(`  ✓ Pool initialized (tx: ${sig.slice(0, 16)}...)`);
  console.log(`    Pool mint: ${mintKeypair.address}`);
  console.log(`    Pool vault: ${poolVaultAta}`);

  saveMintAddress('pool-mint', mintKeypair.address);

  return { poolMint: mintKeypair.address, poolVault: poolVaultAta };
}

async function registerTestSensor(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  usdcMint: string,
  poolMint: string,
  poolVault: string,
): Promise<{ sensorPubkey: string; hardwareEntryPda: string }> {
  const { signer: sensor, created: sensorCreated } = await loadOrGenerateKeypair('sensor');
  console.log(`  ${sensorCreated ? '✓ Generated' : '✓ Loaded'} sensor keypair: ${sensor.address}`);

  const [hardwareEntryPda] = await deriveHardwareEntry(sensor.address);

  const hwAccount = await fetchEncodedAccount(rpc, hardwareEntryPda);
  if (hwAccount.exists) {
    console.log('  ✓ Sensor already registered');

    return { sensorPubkey: sensor.address, hardwareEntryPda };
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

  const ix = buildRegisterSensorIx(
    {
      owner: payer,
      sensorPubkey: sensor.address,
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

  const sig = await sendTx(rpc, payer, [createPoolAtaIx, ix]);
  console.log(`  ✓ Sensor registered (tx: ${sig.slice(0, 16)}...)`);
  console.log(`    Model: Mock Dev Sensor (id=${MODEL_ID}, fee=5 USDC, tokens=50)`);
  console.log(`    HardwareEntry PDA: ${hardwareEntryPda}`);

  return { sensorPubkey: sensor.address, hardwareEntryPda };
}

function printSummary(result: BootstrapResult): void {
  console.log('\n' + '═'.repeat(60));
  console.log('  BOOTSTRAP COMPLETE');
  console.log('═'.repeat(60));

  console.log('\n  On-Chain Addresses:');
  console.log(`    Program ID:       ${PROGRAM_ID}`);
  console.log(`    Mock USDC Mint:   ${result.usdcMint}`);
  console.log(`    Pool Mint:        ${result.poolMint}`);
  console.log(`    GlobalState PDA:  ${result.globalStatePda}`);
  console.log(`    SensorPool PDA:   ${result.sensorPoolPda}`);
  console.log(`    Pool Vault:       ${result.poolVault}`);
  console.log(`    HardwareEntry:    ${result.hardwareEntryPda}`);

  console.log('\n  Keypairs:');
  console.log(`    Payer:            ${result.payerAddress}`);
  console.log(`    Sensor:           ${result.sensorPubkey}`);
  console.log(`    Cosigner:         ${result.cosignerPubkey}`);

  console.log('\n  ─── backend/.env ───');
  console.log(`    SOLANA_RPC_URL=https://api.devnet.solana.com`);
  console.log(`    PROGRAM_ID=${PROGRAM_ID}`);
  console.log(`    COSIGNER_KEYPAIR_PATH=${result.cosignerKeypairPath}`);
  console.log(`    SENSOR_KEYPAIR_PATH=${result.sensorKeypairPath}`);

  console.log('\n  ─── frontend/.env.local ───');
  console.log(`    NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com`);
  console.log(`    NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID}`);
  console.log(`    NEXT_PUBLIC_API_URL=http://localhost:3001`);
  console.log(`    NEXT_PUBLIC_SOLANA_NETWORK=devnet`);

  console.log('\n  ⚠ Keypair files are in scripts/keys/ — do NOT commit them!');
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('\n❌ Bootstrap failed:', err.message ?? err);
  process.exit(1);
});
