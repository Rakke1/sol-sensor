use anchor_lang::prelude::*;

use crate::errors::SolSensorError;
use crate::state::sensor_pool::PRECISION_FACTOR;

/// Per-holder reward tracking state.
///
/// Seeds: `["contrib", holder_pubkey]`
#[account]
pub struct ContributorState {
    /// The pool token holder this account belongs to.
    pub holder: Pubkey,
    /// Snapshot of the pool's `reward_per_token` accumulator taken at the last
    /// settlement.  Used to compute pending rewards without iterating holders.
    pub reward_per_token_paid: u128,
    /// USDC (micro-units) owed to this holder but not yet claimed.
    pub rewards_owed: u64,
    /// PDA bump.
    pub bump: u8,
}

impl ContributorState {
    /// Anchor discriminator (8) + holder (32) + reward_per_token_paid (16) +
    /// rewards_owed (8) + bump (1)
    pub const LEN: usize = 8 + 32 + 16 + 8 + 1;
    pub const SEEDS_PREFIX: &'static [u8] = b"contrib";

    /// Compute USDC rewards earned since the last settlement.
    ///
    /// `token_balance` — current pool token balance of the holder (raw units).
    /// `current_reward_per_token` — the pool's current accumulator value.
    ///
    /// Formula (mirrors Synthetix staking math):
    ///   pending = balance × (current_rpt − paid_rpt) / PRECISION_FACTOR
    pub fn pending_rewards(
        &self,
        token_balance: u64,
        current_reward_per_token: u128,
    ) -> Result<u64> {
        let delta = current_reward_per_token
            .checked_sub(self.reward_per_token_paid)
            .ok_or(error!(SolSensorError::ArithmeticOverflow))?;

        let pending = (token_balance as u128)
            .checked_mul(delta)
            .and_then(|v| v.checked_div(PRECISION_FACTOR))
            .ok_or(error!(SolSensorError::ArithmeticOverflow))?;

        Ok(pending as u64)
    }
}
