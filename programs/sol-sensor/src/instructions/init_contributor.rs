use anchor_lang::prelude::*;

use crate::state::{ContributorState, SensorPool};

/// Accounts required to initialise a ContributorState PDA.
#[derive(Accounts)]
pub struct InitContributor<'info> {
    /// The pool token holder opening their reward-tracking account.
    #[account(mut)]
    pub holder: Signer<'info>,

    /// Pool state — snapshot of `reward_per_token` at init time.
    #[account(seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// Per-holder reward tracking PDA (created here).
    #[account(
        init,
        payer = holder,
        space = ContributorState::LEN,
        seeds = [ContributorState::SEEDS_PREFIX, holder.key().as_ref()],
        bump,
    )]
    pub contributor_state: Account<'info, ContributorState>,

    pub system_program: Program<'info, System>,
}

/// Initialise a ContributorState for a pool token holder.
///
/// The `reward_per_token_paid` field is set to the pool's current accumulator
/// value so that the holder only accrues rewards earned *after* this call.
pub fn handler(ctx: Context<InitContributor>) -> Result<()> {
    let contributor_state = &mut ctx.accounts.contributor_state;
    contributor_state.holder = ctx.accounts.holder.key();
    contributor_state.reward_per_token_paid = ctx.accounts.sensor_pool.reward_per_token;
    contributor_state.rewards_owed = 0;
    contributor_state.bump = ctx.bumps.contributor_state;
    Ok(())
}
