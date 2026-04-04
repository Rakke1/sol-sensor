import type { SensorPool, ContributorState } from '@/types';
import { encodeBase58 } from './base58';

/**
 * SensorPool layout (117 bytes):
 * [0..8]     discriminator
 * [8..40]    mint (Pubkey)
 * [40..72]   vault (Pubkey)
 * [72..88]   reward_per_token (u128 LE)
 * [88..96]   total_distributed (u64 LE)
 * [96..100]  active_sensors (u32 LE)
 * [100..108] total_supply (u64 LE)
 * [108..116] max_supply (u64 LE)
 * [116]      bump (u8)
 */
const SENSOR_POOL_SIZE = 117;

function readU128LE(view: DataView, offset: number): bigint {
  const lo = view.getBigUint64(offset, true);
  const hi = view.getBigUint64(offset + 8, true);

  return (hi << 64n) | lo;
}

export function decodeSensorPool(data: Uint8Array): SensorPool & { mint: string; vault: string } {
  if (data.length < SENSOR_POOL_SIZE) {
    throw new Error(
      `Invalid SensorPool data: expected ${SENSOR_POOL_SIZE} bytes, got ${data.length}`,
    );
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const mint = encodeBase58(data.slice(8, 40));
  const vault = encodeBase58(data.slice(40, 72));
  const rewardPerToken = readU128LE(view, 72);
  const totalDistributed = view.getBigUint64(88, true);
  const activeSensors = view.getUint32(96, true);
  const totalSupply = view.getBigUint64(100, true);
  const maxSupply = view.getBigUint64(108, true);

  return {
    mint,
    vault,
    rewardPerToken,
    totalDistributed,
    activeSensors,
    totalSupply,
    maxSupply,
    totalQueries: 0n,
  };
}

/**
 * ContributorState layout (65 bytes):
 * [0..8]    discriminator
 * [8..40]   holder (Pubkey)
 * [40..56]  reward_per_token_paid (u128 LE)
 * [56..64]  rewards_owed (u64 LE)
 * [64]      bump (u8)
 */
const CONTRIBUTOR_STATE_SIZE = 65;

export function decodeContributorState(
  data: Uint8Array,
): ContributorState & { holder: string } {
  if (data.length < CONTRIBUTOR_STATE_SIZE) {
    throw new Error(
      `Invalid ContributorState data: expected ${CONTRIBUTOR_STATE_SIZE} bytes, got ${data.length}`,
    );
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const holder = encodeBase58(data.slice(8, 40));
  const rewardPerTokenPaid = readU128LE(view, 40);
  const rewardsOwed = view.getBigUint64(56, true);

  return {
    holder,
    rewardPerTokenPaid,
    rewardsOwed,
    tokenBalance: 0n,
  };
}
