use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::state::{ContributorState, SensorPool};

/// Accounts required for the manual reward sync fallback.
#[derive(Accounts)]
pub struct SyncRewards<'info> {
    /// The pool token holder whose rewards need to be synced.
    pub holder: UncheckedAccount<'info>,

    /// Pool state — current reward accumulator.
    #[account(seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// Per-holder reward tracking state.
    #[account(
        mut,
        seeds = [ContributorState::SEEDS_PREFIX, holder.key().as_ref()],
        bump = contributor_state.bump,
        constraint = contributor_state.holder == holder.key(),
    )]
    pub contributor_state: Account<'info, ContributorState>,

    /// Holder's pool token account (current balance).
    #[account(
        constraint = holder_token_account.owner == holder.key(),
        constraint = holder_token_account.mint == sensor_pool.mint,
    )]
    pub holder_token_account: InterfaceAccount<'info, TokenAccount>,
}

/// Manual fallback for the Transfer Hook reward sync.
///
/// Can be called by anyone to settle pending rewards for a holder when the
/// automatic hook cannot fire (e.g., for off-chain settlement or recovery).
pub fn handler(ctx: Context<SyncRewards>) -> Result<()> {
    let sensor_pool = &ctx.accounts.sensor_pool;
    let contributor_state = &mut ctx.accounts.contributor_state;
    let token_balance = ctx.accounts.holder_token_account.amount;
    let current_rpt = sensor_pool.reward_per_token;

    if let Ok(pending) = contributor_state.pending_rewards(token_balance, current_rpt) {
        contributor_state.rewards_owed =
            contributor_state.rewards_owed.saturating_add(pending);
        contributor_state.reward_per_token_paid = current_rpt;
    }

    Ok(())
}
