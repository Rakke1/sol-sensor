use anchor_lang::prelude::*;

/// Precision scaling factor for the reward-per-token accumulator.
/// Prevents integer truncation on micro-payments with large token supplies.
///
/// Example: 40,000 USDC-units / 1,000,000 tokens = 0 in plain integer math.
///          40,000 × 10^12 / 1,000,000 = 40,000,000,000 — no precision loss.
pub const PRECISION_FACTOR: u128 = 1_000_000_000_000;

/// Hard cap on pool token supply.  Prevents inflationary dilution of rewards.
pub const MAX_POOL_SUPPLY: u64 = 10_000_000;

/// Revenue split in basis points (100 bps = 1 %).
pub const SPLIT_HARDWARE_BPS: u16 = 2000; // 20 % → hardware owner
pub const SPLIT_POOL_BPS: u16 = 8000; //     80 % → pool vault

/// Singleton account holding pool-level configuration and the reward accumulator.
///
/// Seeds: `["pool"]`
#[account]
#[derive(Default)]
pub struct SensorPool {
    /// The Token-2022 mint for this pool.
    pub mint: Pubkey,
    /// The USDC vault PDA that holds revenue before it is distributed.
    pub vault: Pubkey,
    /// Global reward-per-token accumulator, scaled by [`PRECISION_FACTOR`].
    pub reward_per_token: u128,
    /// Total USDC (in micro-units) distributed to the vault lifetime.
    pub total_distributed: u64,
    /// Number of currently active sensors in the pool.
    pub active_sensors: u32,
    /// Current circulating supply of pool tokens.
    pub total_supply: u64,
    /// Maximum allowed supply of pool tokens.
    pub max_supply: u64,
    /// PDA bump.
    pub bump: u8,
}

impl SensorPool {
    /// Anchor discriminator (8) + mint (32) + vault (32) + reward_per_token (16) +
    /// total_distributed (8) + active_sensors (4) + total_supply (8) + max_supply (8) + bump (1)
    pub const LEN: usize = 8 + 32 + 32 + 16 + 8 + 4 + 8 + 8 + 1;
    pub const SEEDS: &'static [u8] = b"pool";
}
