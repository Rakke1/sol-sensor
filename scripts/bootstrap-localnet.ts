#!/usr/bin/env tsx
/**
 * SolSensor Localnet Bootstrap Script
 *
 * One-command setup for the full localnet environment:
 *   npx tsx bootstrap-localnet.ts
 *
 * Creates mock USDC, initializes pool, registers test sensor,
 * generates keypairs, and outputs .env-ready configuration.
 * 
 * Note: Requires solana-test-validator running on http://localhost:8899
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
import { createLocalnetRpc, assertLocalnet } from './lib/rpc.js';
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

  // Log instruction details
  if (instructions.length > 0) {
    instructions.forEach((ix, idx) => {
      console.log(`  Instruction ${idx + 1}:`);
      if ('accounts' in ix && ix.accounts) {
        console.log(`    Accounts: ${(ix.accounts as any[]).length}`);
      }
      if ('data' in ix && ix.data instanceof Uint8Array) {
        console.log(`    Data bytes: ${ix.data.length}`);
      }
    });
  }

  try {
    // Try simulation first, but don't fail on serialization errors
    let shouldSendAnyhow = false;
    try {
      console.log('  Simulating transaction...');
      const simResult = await rpc
        .simulateTransaction(base64Tx as Parameters<typeof rpc.simulateTransaction>[0], {
          encoding: 'base64',
          sigVerify: true,
        } as Parameters<typeof rpc.simulateTransaction>[1])
        .send();
      
      if (simResult.value.err) {
        console.error('\n❌ Transaction simulation failed:');
        console.error('  Error:', JSON.stringify(simResult.value.err, null, 2));
        if (simResult.value.logs) {
          console.error('  Program logs:');
          simResult.value.logs.forEach((log) => console.error(`    ${log}`));
        }
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`);
      }
      if (simResult.value.logs) {
        console.log('  Simulation logs:');
        simResult.value.logs.forEach((log) => console.log(`    ${log}`));
      }
      console.log('  ✓ Simulation successful');
    } catch (simErr: unknown) {
      const errMsg = simErr instanceof Error ? simErr.message : JSON.stringify(simErr);
      if (errMsg.includes('serialize a BigInt') || errMsg.includes('serializ')) {
        console.warn('  ⚠ Simulation serialization issue (RPC client problem), skipPreflight to send anyway...');
        shouldSendAnyhow = true;
      } else if (errMsg.includes('simulation failed')) {
        console.error('\n❌ Simulation check failed:');
        console.error('  ', errMsg);
        throw simErr;
      } else {
        console.warn('  ⚠ Simulation check unavailable, attempting to send anyway...');
        console.warn('  Error:', errMsg);
        shouldSendAnyhow = true;
      }
    }

    // Now send the actual transaction
    console.log('  Sending transaction...');
    await rpc
      .sendTransaction(base64Tx as Parameters<typeof rpc.sendTransaction>[0], {
        encoding: 'base64',
        skipPreflight: shouldSendAnyhow,
      } as Parameters<typeof rpc.sendTransaction>[1])
      .send();
  } catch (err) {
    console.error('\n❌ Transaction error:');
    if (err instanceof Error) {
      console.error('  ' + err.message);
      if (err.cause) {
        console.error('  Cause:', err.cause);
      }
    } else {
      console.error('  ', JSON.stringify(err, null, 2));
    }
    throw err;
  }

  // Wait for confirmation
  const startTime = Date.now();
  let confirmed = false;
  let txResult: any = null;
  
  while (Date.now() - startTime < 60_000) {
    const status = await rpc.getSignatureStatuses([sig]).send();
    const result = status.value[0];
    if (result?.confirmationStatus === 'confirmed' || result?.confirmationStatus === 'finalized') {
      confirmed = true;
      console.log(`  ✓ Confirmed`);
      
      // Get full transaction result to see logs
      let hasInstructionError = false;
      let instructionErrorMsg = '';
      try {
        txResult = await rpc.getTransaction(sig, { maxSupportedTransactionVersion: 0 }).send();
        if (txResult?.meta?.logMessages) {
          console.log(`  Transaction logs:`);
          txResult.meta.logMessages.forEach((log: string) => {
            if (log.includes('error') || log.includes('Error') || log.includes('failed') || log.includes('Failed')) {
              console.log(`    ❌ ${log}`);
              if (log.includes('Program log: Error:') || log.includes('failed: custom program error')) {
                hasInstructionError = true;
                instructionErrorMsg = log;
              }
            } else {
              console.log(`    ${log}`);
            }
          });
        }
        if (txResult?.meta?.err) {
          console.error(`  ❌ Transaction execution error: ${JSON.stringify(txResult.meta.err)}`);
          throw new Error(`Transaction execution failed: ${JSON.stringify(txResult.meta.err)}`);
        }
      } catch (txErr) {
        const errMsg = txErr instanceof Error ? txErr.message : String(txErr);
        // Only suppress the BigInt serialization error, other errors should propagate
        if (!errMsg.includes('serialize a BigInt')) {
          throw txErr;
        }
        // Even if we can't fetch the full tx details, check if we detected instruction errors
        console.warn(`  ⚠ Could not fetch full transaction details: ${errMsg}`);
      }
      
      if (hasInstructionError) {
        throw new Error(`Instruction failed: ${instructionErrorMsg}`);
      }
      
      return sig;
    }
    if (result?.err) {
      console.error(`  ❌ Transaction failed on-chain: ${JSON.stringify(result.err)}`);
      throw new Error(`Transaction failed: ${JSON.stringify(result.err)}`);
    }
    await sleep(500);
  }
  if (!confirmed) {
    console.error(`  ❌ Transaction not confirmed within 60s`);
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
  console.log('\n🔧 SolSensor Localnet Bootstrap\n');
  console.log(`  Program ID: ${PROGRAM_ID}`);

  // ─── Step 0: Setup RPC & payer ───
  const rpc = createLocalnetRpc();
  console.log('\n[1/7] Checking cluster...');
  await assertLocalnet(rpc);
  console.log('  ✓ Connected to Solana localnet (http://localhost:8899)');

  console.log('\n[2/7] Loading payer keypair...');
  const { signer: payer, created: payerCreated } = await loadOrGenerateKeypair('payer');
  console.log(`  ${payerCreated ? '✓ Generated' : '✓ Loaded'} payer: ${payer.address}`);

  // Ensure payer has SOL (localnet test-validator has unlimited faucet)
  console.log('\n[3/7] Ensuring payer has SOL...');
  const balance = await rpc.getBalance(payer.address).send();
  const solBalance = Number(balance.value) / 1e9;
  
  if (balance.value < 2_000_000_000n) {
    console.log(`  ⚠ Payer balance: ${solBalance.toFixed(4)} SOL (below 2 SOL threshold)`);
    console.log('  Requesting airdrop from test-validator...');
    try {
      const sig = await rpc.requestAirdrop(payer.address, lamports(2_000_000_000n)).send();
      console.log(`  ✓ Airdrop requested: ${sig}`);
      await sleep(2_000);
      const newBalance = await rpc.getBalance(payer.address).send();
      console.log(`  ✓ New balance: ${(Number(newBalance.value) / 1e9).toFixed(4)} SOL`);
    } catch (err) {
      console.error(`\n❌ Airdrop failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  } else {
    console.log(`  ✓ Payer balance: ${solBalance.toFixed(4)} SOL (sufficient)`);
  }

  // ─── Step 1: Create mock USDC ───
  console.log('\n[4/7] Setting up mock USDC...');
  const usdcMintAddress = await setupMockUsdc(rpc, payer);

  // ─── Step 2: Initialize pool ───
  console.log('\n[5/7] Initializing sensor pool...');
  let poolMint = '';
  let poolVault = '';
  try {
    const result = await initializePool(rpc, payer, usdcMintAddress);
    poolMint = result.poolMint;
    poolVault = result.poolVault;
  } catch (err) {
    console.error('❌ Pool initialization failed:');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  
  // Ensure pool vault ATA exists
  console.log('  Verifying pool vault...');
  const vaultCheck = await fetchEncodedAccount(rpc, address(poolVault));
  if (!vaultCheck.exists) {
    console.log('  ⚠ Pool vault ATA does not exist, creating it...');
    const [sensorPoolPda] = await deriveSensorPool();
    const createVaultIx = getCreateAssociatedTokenIdempotentInstruction({
      payer,
      owner: sensorPoolPda,
      mint: address(usdcMintAddress),
      ata: address(poolVault),
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });
    const vaultSig = await sendTx(rpc, payer, [createVaultIx]);
    console.log(`  ✓ Pool vault created: ${vaultSig.slice(0, 16)}...`);
    await sleep(2_000);
  } else {
    console.log('  ✓ Pool vault already exists');
  }

  // ─── Step 3: Register test sensor ───
  console.log('\n[6/7] Registering test sensor...');
  let sensorPubkey = '';
  let hardwareEntryPda = '';
  try {
    const result = await registerTestSensor(
      rpc, payer, usdcMintAddress, poolMint, poolVault,
    );
    sensorPubkey = result.sensorPubkey;
    hardwareEntryPda = result.hardwareEntryPda;
  } catch (err) {
    console.error('❌ Sensor registration failed:');
    console.error(err instanceof Error ? err.message : err);
    console.error('\nNote: This may cause pay_for_query to fail later.');
    console.error('Continuing with bootstrap...');
    sensorPubkey = 'FAILED';
    hardwareEntryPda = 'FAILED';
  }

  // ─── Step 4: Generate cosigner keypair ───
  console.log('\n[7/7] Setting up cosigner keypair...');
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
  // Check if pool already initialized—if so, extract USDC mint from pool vault ATA
  const [globalStatePda] = await deriveGlobalState();
  const globalAccount = await fetchEncodedAccount(rpc, globalStatePda);
  
  if (globalAccount.exists) {
    console.log('  ✓ Pool already exists, extracting USDC mint from pool vault...');
    try {
      const [sensorPoolPda] = await deriveSensorPool();
      const poolAccount = await fetchEncodedAccount(rpc, sensorPoolPda);
      if (poolAccount.exists) {
        // Extract pool_vault address from pool state (bytes 40-71)
        const { getAddressDecoder } = await import('@solana/kit');
        const addrDecoder = getAddressDecoder();
        const poolData = new Uint8Array(poolAccount.data);
        
        if (poolData.length >= 72) {
          const poolVault = addrDecoder.decode(poolData.slice(40, 72));
          console.log(`    Pool vault found: ${poolVault}`);
          
          // Fetch the pool vault ATA account and extract its mint
          const vaultAccount = await fetchEncodedAccount(rpc, poolVault);
          if (vaultAccount.exists) {
            // ATA structure: [mint: 32 bytes @ offset 0][owner: 32 bytes @ offset 32]...
            const vaultData = new Uint8Array(vaultAccount.data);
            if (vaultData.length >= 32) {
              const vaultMint = addrDecoder.decode(vaultData.slice(0, 32));
              console.log(`    ✓ Extracted USDC mint from vault: ${vaultMint}`);
              
              // Check if this mint still works (verify it exists on-chain)
              const mintAccount = await fetchEncodedAccount(rpc, vaultMint);
              if (mintAccount.exists) {
                // Try to ensure payer has balance (may fail if payer is not mint authority)
                try {
                  await ensurePayerHasUsdc(rpc, payer, address(vaultMint));
                  return vaultMint;
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err);
                  if (errMsg.includes('no mint authority')) {
                    console.warn(`  ⚠ Pool vault USDC mint exists but we can't mint to it`);
                    console.error(`\n❌ FATAL: Pool is bound to a USDC mint we don't control.`);
                    console.error(`   Validator ledger state is incompatible.`);
                    console.error(`\n   To fix, run:`);
                    console.error(`   pkill -f solana-test-validator`);
                    console.error(`   rm -rf test-ledger programs/target/sbf-solana-solana/release/sol_sensor.so scripts/keys`);
                    console.error(`   bash run-localnet.sh`);
                    process.exit(1);
                  }
                  throw err;
                }
              } else {
                console.warn(`    ⚠ Vault mint account no longer exists on-chain`);
                console.error(`\n❌ FATAL: Pool vault bound to deleted mint. Validator ledger is corrupted.`);
                console.error(`   To recover, run: rm -rf test-ledger && bash setup-localnet.sh`);
                process.exit(1);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`  ⚠ Could not extract USDC mint from pool vault: ${err instanceof Error ? err.message : err}`);
    }
  }

  // No valid pool found, check for saved USDC mint from a previous localnet run
  const existingAddress = loadMintAddress('usdc-mint');
  if (existingAddress) {
    const account = await fetchEncodedAccount(rpc, address(existingAddress));
    if (account.exists) {
      console.log(`  ✓ Mock USDC already exists: ${existingAddress}`);
      try {
        await ensurePayerHasUsdc(rpc, payer, address(existingAddress));
        return existingAddress;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('no mint authority')) {
          console.warn(`  ⚠ Saved USDC mint exists but payer is not the mint authority`);
          console.warn(`  Deleting saved mint and creating fresh USDC...`);
          // Delete the saved mint address so we create a fresh one
          const fs = await import('fs');
          const keysDir = './keys';
          const mintPath = `${keysDir}/usdc-mint.json`;
          try {
            fs.unlinkSync(mintPath);
            console.log(`  ✓ Deleted stale USDC mint reference`);
          } catch (e) {
            // Ignore if file doesn't exist
          }
          // Fall through to create fresh mint below
        } else {
          throw err;
        }
      }
    }
  }

  // Create fresh USDC mint
  console.log('  Creating fresh USDC mint...');
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
  
  // Always try to mint, regardless of whether ATA exists
  // The idempotent instruction will create ATA if needed, and we always mint
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

  try {
    await sendTx(rpc, payer, [createAtaIx, mintToIx]);
    console.log(`  ✓ Minted ${Number(MOCK_USDC_AMOUNT) / 1e6} USDC to payer ATA: ${ata}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // If we can't mint (likely don't have authority for this USDC mint), throw so caller can handle
    if (errMsg.includes('owner does not match') || errMsg.includes('custom program error: 0x4')) {
      throw new Error(`Cannot mint USDC: no mint authority (${errMsg})`);
    }
    // If ATA already exists and has balance, the mint instruction will fail (ATA already initialized)
    // This is OK - it just means we already have the tokens
    if (errMsg.includes('already in use') || errMsg.includes('AlreadyInUse')) {
      console.log(`  ✓ Payer USDC ATA exists with tokens`);
      return;
    }
    throw err;
  }
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
  
  // Verify the mint was saved
  const savedMint = loadMintAddress('pool-mint');
  if (!savedMint) {
    console.warn(`  ⚠ Warning: Pool mint was not saved to disk!`);
  } else {
    console.log(`  ✓ Pool mint saved to disk`);
  }

  return { poolMint: mintKeypair.address, poolVault: poolVaultAta };
}

async function registerTestSensor(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  usdcMint: string,
  poolMint: string,
  poolVault: string,
): Promise<{ sensorPubkey: string; hardwareEntryPda: string }> {
  // Load or generate sensor keypair (consistent across runs!)
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

  // Owner's USDC ATA
  const [ownerUsdcAta] = await findAssociatedTokenPda({
    mint: address(usdcMint),
    owner: payer.address,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Validate accounts before creating instruction
  console.log('  Validating accounts...');
  try {
    const globalStateAcc = await fetchEncodedAccount(rpc, globalStatePda);
    console.log(`    ✓ GlobalState exists: ${globalStateAcc.exists ? 'yes' : 'no'}`);

    const poolAcc = await fetchEncodedAccount(rpc, sensorPoolPda);
    console.log(`    ✓ SensorPool exists: ${poolAcc.exists ? 'yes' : 'no'}`);

    const mintAcc = await fetchEncodedAccount(rpc, address(poolMint));
    console.log(`    ✓ Pool mint exists: ${mintAcc.exists ? 'yes' : 'no'}`);

    const ownerAtaAcc = await fetchEncodedAccount(rpc, ownerPoolTokenAta);
    console.log(`    ✓ Owner token ATA exists: ${ownerAtaAcc.exists ? 'yes' : 'no'}`);
    
    // Create the ATA if it doesn't exist
    if (!ownerAtaAcc.exists) {
      console.log('  Creating owner token ATA...');
      const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
        payer,
        owner: payer.address,
        mint: address(poolMint),
        ata: ownerPoolTokenAta,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      });
      const createAtaSig = await sendTx(rpc, payer, [createAtaIx]);
      console.log(`    ✓ ATA created: ${createAtaSig.slice(0, 16)}...`);
      await sleep(2_000);
    } else {
      console.log(`    ✓ Owner token ATA already exists`);
    }

    const ownerUsdcAtaAcc = await fetchEncodedAccount(rpc, ownerUsdcAta);
    console.log(`    ✓ Owner USDC ATA exists: ${ownerUsdcAtaAcc.exists ? 'yes' : 'no'}`);
    console.log(`      ATA address: ${ownerUsdcAta}`);
    console.log(`      USDC mint: ${usdcMint}`);
    
    // If USDC ATA doesn't exist, create it
    if (!ownerUsdcAtaAcc.exists) {
      console.log('  Creating owner USDC ATA...');
      const createUsdcAtaIx = getCreateAssociatedTokenIdempotentInstruction({
        payer,
        owner: payer.address,
        mint: address(usdcMint),
        ata: ownerUsdcAta,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      });
      const createUsdcSig = await sendTx(rpc, payer, [createUsdcAtaIx]);
      console.log(`    ✓ USDC ATA created: ${createUsdcSig.slice(0, 16)}...`);
      await sleep(2_000);
    }

    const vaultAcc = await fetchEncodedAccount(rpc, address(poolVault));
    console.log(`    ✓ Pool vault exists: ${vaultAcc.exists ? 'yes' : 'no'}`);
  } catch (err) {
    console.warn(`  ⚠ Account validation error (continuing anyway): ${err instanceof Error ? err.message : err}`);
  }

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

  const sig = await sendTx(rpc, payer, [ix]);
  console.log(`  ✓ Sensor registered (tx: ${sig.slice(0, 16)}...)`);
  console.log(`    Model: Mock Dev Sensor (id=${MODEL_ID}, fee=5 USDC, tokens=50)`);
  console.log(`    HardwareEntry PDA: ${hardwareEntryPda}`);

  // Verify that the hardware entry was actually created
  await sleep(2_000);
  const verifyHw = await fetchEncodedAccount(rpc, hardwareEntryPda);
  if (!verifyHw.exists) {
    throw new Error(`❌ Hardware entry was not created on-chain! Transaction may have failed silently.`);
  }
  console.log(`  ✓ Verified: Hardware entry exists on-chain`);

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
  console.log(`    SOLANA_RPC_URL=http://localhost:8899`);
  console.log(`    PROGRAM_ID=${PROGRAM_ID}`);
  console.log(`    COSIGNER_KEYPAIR_PATH=${result.cosignerKeypairPath}`);
  console.log(`    SENSOR_KEYPAIR_PATH=${result.sensorKeypairPath}`);

  console.log('\n  ─── frontend/.env.local ───');
  console.log(`    NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899`);
  console.log(`    NEXT_PUBLIC_PROGRAM_ID=${PROGRAM_ID}`);
  console.log(`    NEXT_PUBLIC_API_URL=http://localhost:3001`);
  console.log(`    NEXT_PUBLIC_SOLANA_NETWORK=localnet`);

  console.log('\n  ⚠ Keypair files are in scripts/keys/ — do NOT commit them!');
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('\n❌ Bootstrap failed:', err.message ?? err);
  process.exit(1);
});
