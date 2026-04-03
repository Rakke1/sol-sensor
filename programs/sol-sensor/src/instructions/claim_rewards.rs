use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::{
    errors::SolSensorError,
    state::{ContributorState, SensorPool},
};

/// Accounts required to claim accumulated USDC rewards.
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    /// The pool token holder claiming their rewards.
    #[account(mut)]
    pub holder: Signer<'info>,

    /// Pool state — current reward accumulator.
    /// PDA signs the vault → holder transfer.
    #[account(mut, seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// Per-holder reward tracking state.
    #[account(
        mut,
        seeds = [ContributorState::SEEDS_PREFIX, holder.key().as_ref()],
        bump = contributor_state.bump,
        constraint = contributor_state.holder == holder.key(),
    )]
    pub contributor_state: Account<'info, ContributorState>,

    /// Holder's pool token account (balance used in reward calculation).
    #[account(
        constraint = holder_token_account.owner == holder.key(),
        constraint = holder_token_account.mint == sensor_pool.mint,
    )]
    pub holder_token_account: InterfaceAccount<'info, TokenAccount>,

    /// USDC mint — needed for `transfer_checked`.
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// Holder's USDC token account (reward destination).
    #[account(mut)]
    pub holder_usdc: InterfaceAccount<'info, TokenAccount>,

    /// Pool vault USDC token account (reward source).
    /// Signed by the `sensor_pool` PDA.
    #[account(mut, address = sensor_pool.vault)]
    pub pool_vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

/// Claim accumulated USDC rewards for a pool token holder.
///
/// Uses precision-scaled reward-per-token accounting to compute pending rewards
/// without iterating all holders.  The pool vault PDA signs the transfer.
pub fn handler(ctx: Context<ClaimRewards>) -> Result<()> {
    let sensor_pool = &ctx.accounts.sensor_pool;
    let contributor_state = &mut ctx.accounts.contributor_state;
    let token_balance = ctx.accounts.holder_token_account.amount;

    let pending = contributor_state
        .pending_rewards(token_balance, sensor_pool.reward_per_token)
        .map_err(|_| SolSensorError::ArithmeticOverflow)?;

    let total_claimable = contributor_state
        .rewards_owed
        .checked_add(pending)
        .ok_or(SolSensorError::ArithmeticOverflow)?;

    require!(total_claimable > 0, SolSensorError::NoRewardsToClaim);

    // Settle the contributor state snapshot before the external transfer.
    contributor_state.reward_per_token_paid = sensor_pool.reward_per_token;
    contributor_state.rewards_owed = 0;

    // Transfer USDC from pool vault to holder, signed by sensor_pool PDA.
    let pool_bump = ctx.accounts.sensor_pool.bump;
    let seeds: &[&[u8]] = &[SensorPool::SEEDS, &[pool_bump]];
    let signer_seeds = &[seeds];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.pool_vault.to_account_info(),
        mint: ctx.accounts.usdc_mint.to_account_info(),
        to: ctx.accounts.holder_usdc.to_account_info(),
        authority: ctx.accounts.sensor_pool.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    let decimals = ctx.accounts.usdc_mint.decimals;
    token_interface::transfer_checked(cpi_ctx, total_claimable, decimals)?;

    msg!(
        "claim_rewards: holder={}, payout={}",
        ctx.accounts.holder.key(),
        total_claimable
    );

    Ok(())
}
