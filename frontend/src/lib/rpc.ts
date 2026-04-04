import { createSolanaRpc } from '@solana/kit';
import { SOLANA_RPC_URL } from './constants';

export const rpc = createSolanaRpc(SOLANA_RPC_URL);
