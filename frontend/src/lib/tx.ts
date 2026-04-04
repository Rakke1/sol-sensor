import {
  Connection,
  PublicKey,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { AccountRole } from '@solana/kit';
import { SOLANA_RPC_URL } from './constants';
import type { SolSensorInstruction } from './program';

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

function toWeb3Instruction(ix: SolSensorInstruction): TransactionInstruction {
  const keys = ix.accounts.map((acc) => ({
    pubkey: new PublicKey(acc.address),
    isSigner:
      acc.role === AccountRole.READONLY_SIGNER ||
      acc.role === AccountRole.WRITABLE_SIGNER,
    isWritable:
      acc.role === AccountRole.WRITABLE ||
      acc.role === AccountRole.WRITABLE_SIGNER,
  }));

  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys,
    data: Buffer.from(ix.data),
  });
}

/**
 * Build, sign via Phantom, and send a transaction.
 * Returns the confirmed signature.
 */
export async function signAndSendTransaction(
  instructions: SolSensorInstruction[],
  walletAddress: string,
): Promise<string> {
  const wallet = window.solana;
  if (!wallet) {
    throw new Error('No Solana wallet found');
  }

  const feePayer = new PublicKey(walletAddress);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const web3Instructions = instructions.map(toWeb3Instruction);

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: web3Instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  const signed = await wallet.signTransaction(tx);
  const rawBytes = signed.serialize();

  const signature = await connection.sendRawTransaction(rawBytes, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed',
  );

  return signature;
}
