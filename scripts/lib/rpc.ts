import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  lamports,
  type Rpc,
  type SolanaRpcApi,
  type RpcSubscriptions,
  type SolanaRpcSubscriptionsApi,
  type KeyPairSigner,
  getAddressFromPublicKey,
} from '@solana/kit';

const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const DEVNET_WSS_URL = 'wss://api.devnet.solana.com';

export function createRpc(url?: string): Rpc<SolanaRpcApi> {
  return createSolanaRpc(url ?? DEVNET_RPC_URL);
}

export function createRpcSubscriptions(url?: string): RpcSubscriptions<SolanaRpcSubscriptionsApi> {
  return createSolanaRpcSubscriptions(url ?? DEVNET_WSS_URL);
}

export async function assertDevnet(rpc: Rpc<SolanaRpcApi>): Promise<void> {
  const genesisHash = await rpc.getGenesisHash().send();
  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error(
      `This script only works on devnet. Got genesis hash: ${genesisHash} (expected ${DEVNET_GENESIS_HASH})`,
    );
  }
}

export async function getSolBalance(rpc: Rpc<SolanaRpcApi>, signer: KeyPairSigner): Promise<bigint> {
  const balance = await rpc.getBalance(signer.address).send();

  return balance.value;
}

export async function ensureSolBalance(
  rpc: Rpc<SolanaRpcApi>,
  signer: KeyPairSigner,
  opts: { minLamports: bigint; airdropLamports: bigint },
): Promise<void> {
  const balance = await getSolBalance(rpc, signer);
  const solBalance = Number(balance) / 1e9;

  if (balance >= opts.minLamports) {
    console.log(`  ✓ Payer balance: ${solBalance.toFixed(4)} SOL (sufficient)`);

    return;
  }

  console.log(`  ⚠ Payer balance: ${solBalance.toFixed(4)} SOL (below ${Number(opts.minLamports) / 1e9} SOL threshold)`);
  console.log('  Requesting airdrop...');

  try {
    const sig = await rpc.requestAirdrop(signer.address, lamports(opts.airdropLamports)).send();
    console.log(`  ✓ Airdrop requested: ${sig}`);
    console.log('  Waiting for confirmation...');
    await sleep(15_000);

    const newBalance = await getSolBalance(rpc, signer);
    console.log(`  ✓ New balance: ${(Number(newBalance) / 1e9).toFixed(4)} SOL`);
  } catch (err) {
    console.warn('  ⚠ Airdrop failed (rate limit or faucet dry)');
    console.warn('    → Get devnet SOL at: https://faucet.solana.com');

    const currentBalance = await getSolBalance(rpc, signer);
    if (currentBalance === 0n) {
      throw new Error('Payer has 0 SOL and airdrop failed. Fund the wallet manually and retry.');
    }
    console.warn(`    Current balance: ${(Number(currentBalance) / 1e9).toFixed(4)} SOL — continuing anyway`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
