/**
 * USDC auto-faucet: checks wallet balance and mints 100 USDC if < 10 USDC.
 * Uses the cosigner keypair (mint authority) to mint via Token-2022.
 */

import * as crypto from 'crypto';
import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getTransactionEncoder,
  fetchEncodedAccount,
  address,
  AccountRole,
  type Address,
  type Instruction,
  type AccountMeta,
  type AccountSignerMeta,
  type Signature,
  type KeyPairSigner,
} from '@solana/kit';
import { rpc, USDC_MINT_ADDRESS } from '../config';
import { getCosigner } from './solana';
import { getAssociatedTokenAddress } from '../utils/ata';

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const ATP_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;

const BALANCE_THRESHOLD = 10_000_000n; // 10 USDC (6 decimals)
const FAUCET_AMOUNT = 100_000_000n; // 100 USDC

const txEncoder = getTransactionEncoder();

type AnyAccountMeta = AccountMeta | AccountSignerMeta;

/**
 * Fetch the token balance from a Token-2022 account.
 * Returns 0n if the account doesn't exist.
 * Token amount is at bytes [64..72] as u64 LE.
 */
export async function getUsdcBalance(
  walletAddress: Address,
): Promise<bigint> {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, walletAddress);
    const account = await fetchEncodedAccount(rpc, ata);

    if (!account.exists) {
      return 0n;
    }

    const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
    // Token-2022 account: amount is at offset 64
    const amount = view.getBigUint64(64, true);

    return amount;
  } catch (err) {
    console.warn(`[Faucet] Failed to fetch balance for ${walletAddress}:`, err);
    return 0n;
  }
}

/**
 * Build a CreateAssociatedTokenIdempotent instruction.
 * Raw Token-2022 instruction: type byte 0x01, 6 accounts.
 */
function buildCreateAtaIx(
  payer: KeyPairSigner,
  owner: Address,
  ata: Address,
): Instruction<string, readonly AnyAccountMeta[]> {
  return {
    programAddress: ATP_PROGRAM,
    accounts: [
      { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer },
      { address: ata, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.READONLY },
      { address: USDC_MINT_ADDRESS, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      { address: TOKEN_2022_PROGRAM, role: AccountRole.READONLY },
    ],
    data: new Uint8Array([0x01]), // CreateIdempotent
  };
}

/**
 * Build a MintTo instruction.
 * Raw Token-2022 instruction: type byte 0x07, mint amount as u64 LE.
 */
function buildMintToIx(
  mintAuthority: KeyPairSigner,
  ata: Address,
  amount: bigint,
): Instruction<string, readonly AnyAccountMeta[]> {
  const data = new Uint8Array(9);
  data[0] = 0x07; // MintTo
  const view = new DataView(data.buffer, 1, 8);
  view.setBigUint64(0, amount, true);

  return {
    programAddress: TOKEN_2022_PROGRAM,
    accounts: [
      { address: USDC_MINT_ADDRESS, role: AccountRole.WRITABLE },
      { address: ata, role: AccountRole.WRITABLE },
      { address: mintAuthority.address, role: AccountRole.WRITABLE_SIGNER, signer: mintAuthority },
    ],
    data,
  };
}

interface MintResult {
  funded: boolean;
  sig?: string;
  message?: string;
}

/**
 * Check wallet USDC balance and mint 100 USDC if below 10 USDC threshold.
 */
export async function mintUsdcToWallet(walletAddressStr: string, injectedRpc?: typeof rpc): Promise<MintResult> {
  const walletAddress = address(walletAddressStr);

  // Check balance
  const balance = await getUsdcBalance(walletAddress);
  if (balance >= BALANCE_THRESHOLD) {
    return {
      funded: false,
      message: `Balance ${Number(balance) / 1e6} USDC already ≥ 10 USDC`,
    };
  }

  // Get mint authority (cosigner)
  const mintAuthority = await getCosigner();
  if (!mintAuthority) {
    throw new Error('Cosigner keypair not loaded — faucet unavailable');
  }

  // Derive ATA
  const ata = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, walletAddress);

  // Build instructions
  const createAtaIx = buildCreateAtaIx(mintAuthority, walletAddress, ata);
  const mintToIx = buildMintToIx(mintAuthority, ata, FAUCET_AMOUNT);

  // Send transaction
  try {
    const rpcToUse = injectedRpc || rpc;
    const { value: latestBlockhash } = await rpcToUse.getLatestBlockhash().send();
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(mintAuthority, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions([createAtaIx, mintToIx], m),
    );

    const signedTx = await signTransactionMessageWithSigners(msg);
    const sig: Signature = getSignatureFromTransaction(signedTx);
    const wireBytes = txEncoder.encode(signedTx);
    const base64Tx = Buffer.from(wireBytes).toString('base64');

    await rpcToUse
      .sendTransaction(base64Tx as Parameters<typeof rpc.sendTransaction>[0], {
        encoding: 'base64',
        skipPreflight: false,
      } as Parameters<typeof rpc.sendTransaction>[1])
      .send();

    console.log(`[Faucet] Minted 100 USDC to ${walletAddressStr} (sig: ${sig})`);

    return {
      funded: true,
      sig,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`[Faucet] Failed to mint for ${walletAddressStr}:`, errMsg);
    throw new Error(`Faucet mint failed: ${errMsg}`);
  }
}
