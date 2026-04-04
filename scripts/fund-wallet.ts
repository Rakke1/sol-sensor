#!/usr/bin/env tsx
/**
 * Fund a wallet with mock USDC for testing.
 * Usage: npx tsx fund-wallet.ts <wallet-address> [amount-usdc]
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
  address,
  type KeyPairSigner,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from '@solana/kit';

import {
  getMintToInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';

import { loadOrGenerateKeypair, loadMintAddress } from './lib/keypair.js';
import { createRpc, assertDevnet } from './lib/rpc.js';

const txEncoder = getTransactionEncoder();

async function sendTx(
  rpc: Rpc<SolanaRpcApi>,
  payer: KeyPairSigner,
  instructions: Parameters<typeof appendTransactionMessageInstructions>[0],
): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(msg);
  const wireBytes = txEncoder.encode(signed);
  const base64Tx = Buffer.from(wireBytes).toString('base64');
  const sig = getSignatureFromTransaction(signed);
  await rpc
    .sendTransaction(base64Tx as Parameters<typeof rpc.sendTransaction>[0], {
      encoding: 'base64',
      skipPreflight: false,
    } as Parameters<typeof rpc.sendTransaction>[1])
    .send();

  const MAX_WAIT = 30_000;
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT) {
    const { value } = await rpc.getSignatureStatuses([sig as Signature & string]).send();
    if (value[0]?.confirmationStatus === 'confirmed' || value[0]?.confirmationStatus === 'finalized') {
      return sig;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  return sig;
}

async function main() {
  const walletArg = process.argv[2];
  if (!walletArg) {
    console.error('Usage: npx tsx fund-wallet.ts <wallet-address> [amount-usdc]');
    process.exit(1);
  }

  const amountUsdc = Number(process.argv[3] ?? '100');
  const amountRaw = BigInt(Math.round(amountUsdc * 1_000_000));

  const rpc = createRpc();
  await assertDevnet(rpc);

  const { signer: payer } = await loadOrGenerateKeypair('payer');
  const usdcMintStr = loadMintAddress('usdc-mint');
  if (!usdcMintStr) {
    console.error('❌ No usdc-mint found. Run bootstrap-devnet.ts first.');
    process.exit(1);
  }

  const usdcMint = address(usdcMintStr);
  const walletAddr = address(walletArg);

  console.log(`Funding ${walletArg} with ${amountUsdc} mock USDC...`);
  console.log(`  USDC Mint: ${usdcMintStr}`);
  console.log(`  Payer (mint authority): ${payer.address}`);

  const [ata] = await findAssociatedTokenPda({
    mint: usdcMint,
    owner: walletAddr,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  console.log(`  Target ATA: ${ata}`);

  const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
    payer,
    owner: walletAddr,
    mint: usdcMint,
    ata,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  const mintToIx = getMintToInstruction({
    mint: usdcMint,
    token: ata,
    mintAuthority: payer,
    amount: amountRaw,
  });

  const sig = await sendTx(rpc, payer, [createAtaIx, mintToIx]);
  console.log(`\n✅ Done! Minted ${amountUsdc} USDC to ${walletArg}`);
  console.log(`   ATA: ${ata}`);
  console.log(`   Tx: ${sig}`);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message ?? err);
  process.exit(1);
});
