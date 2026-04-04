#!/usr/bin/env tsx
/**
 * Verify bootstrap state - check if sensor is registered on-chain
 */

import { fetchEncodedAccount, address } from '@solana/kit';
import { loadOrGenerateKeypair, loadMintAddress } from './lib/keypair.js';
import { createLocalnetRpc, assertLocalnet } from './lib/rpc.js';
import { deriveGlobalState, deriveSensorPool, deriveHardwareEntry } from './lib/pda.js';

async function main(): Promise<void> {
  console.log('\n📋 Bootstrap State Check\n');

  const rpc = createLocalnetRpc();
  
  try {
    await assertLocalnet(rpc);
    console.log('  ✓ Connected to localnet');
  } catch (err) {
    console.error('  ❌ Cannot connect to localnet');
    console.error('  Make sure solana-test-validator is running');
    process.exit(1);
  }

  // Check keypairs
  const { signer: payer } = await loadOrGenerateKeypair('payer');
  const { signer: sensor } = await loadOrGenerateKeypair('sensor');
  console.log('\nKeypairs:');
  console.log(`  Payer:  ${payer.address}`);
  console.log(`  Sensor: ${sensor.address}`);

  // Check PDAs
  const [globalStatePda] = await deriveGlobalState();
  const [sensorPoolPda] = await deriveSensorPool();
  const [hardwareEntryPda] = await deriveHardwareEntry(sensor.address);

  console.log('\nPDAs:');
  console.log(`  GlobalState:   ${globalStatePda}`);
  console.log(`  SensorPool:    ${sensorPoolPda}`);
  console.log(`  HardwareEntry: ${hardwareEntryPda}`);

  // Check on-chain accounts
  console.log('\nOn-chain Accounts:');
  
  const globalStateAcc = await fetchEncodedAccount(rpc, globalStatePda);
  console.log(`  GlobalState:    ${globalStateAcc.exists ? '✓ EXISTS' : '❌ MISSING'}`);
  
  const poolAcc = await fetchEncodedAccount(rpc, sensorPoolPda);
  console.log(`  SensorPool:     ${poolAcc.exists ? '✓ EXISTS' : '❌ MISSING'}`);
  
  const hardwareAcc = await fetchEncodedAccount(rpc, hardwareEntryPda);
  console.log(`  HardwareEntry:  ${hardwareAcc.exists ? '✓ EXISTS' : '❌ MISSING'}`);

  // Check mints
  const usdcMint = loadMintAddress('usdc-mint');
  const poolMint = loadMintAddress('pool-mint');
  
  console.log('\nMints (from keys/):');
  console.log(`  USDC: ${usdcMint || '❌ NOT SAVED'}`);
  console.log(`  Pool: ${poolMint || '❌ NOT SAVED'}`);

  if (!globalStateAcc.exists) {
    console.log('\n⚠ Bootstrap was not run or validator state was lost!');
    console.log('Run: npm run bootstrap:localnet');
    process.exit(1);
  }

  if (!hardwareAcc.exists) {
    console.log('\n⚠ Sensor registration failed or was lost!');
    console.log('The pay_for_query instruction will fail without this.');
    console.log('\nTry re-running bootstrap and ensuring validator stays running.');
    process.exit(1);
  }

  console.log('\n✅ Bootstrap state looks good!');
}

main().catch(err => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
