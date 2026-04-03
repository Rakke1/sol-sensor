use anchor_lang::prelude::*;

use crate::state::{ContributorState, SensorPool};

/// Accounts required by the Token-2022 Transfer Hook.
///
/// The Token-2022 runtime invokes this with the standard transfer accounts
/// **plus** the extra accounts listed in the `ExtraAccountMetaList` PDA.
#[derive(Accounts)]
pub struct TransferHook<'info> {
    /// Source token account (transferring tokens out).
    #[account(token::mint = mint)]
    pub source_token: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,

    /// Pool mint.
    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,

    /// Destination token account (receiving tokens).
    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,

    /// Transfer authority (owner of source account).
    pub authority: UncheckedAccount<'info>,

    /// ExtraAccountMetaList PDA (required by Transfer Hook interface).
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// Pool state — current reward accumulator.
    #[account(seeds = [SensorPool::SEEDS], bump = sensor_pool.bump)]
    pub sensor_pool: Account<'info, SensorPool>,

    /// Sender's ContributorState PDA.
    #[account(
        mut,
        seeds = [ContributorState::SEEDS_PREFIX, source_token.owner.as_ref()],
        bump = sender_contributor.bump,
    )]
    pub sender_contributor: Account<'info, ContributorState>,

    /// Receiver's ContributorState PDA.
    #[account(
        mut,
        seeds = [ContributorState::SEEDS_PREFIX, destination_token.owner.as_ref()],
        bump = receiver_contributor.bump,
    )]
    pub receiver_contributor: Account<'info, ContributorState>,
}

/// Token-2022 Transfer Hook handler.
///
/// Automatically invoked by the Token-2022 runtime on every pool token transfer.
/// Settles pending rewards for both parties using pre-transfer balances so that
/// the reward accumulator snapshot is taken before the balance changes.
pub fn handler(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    let sensor_pool = &ctx.accounts.sensor_pool;
    let current_rpt = sensor_pool.reward_per_token;

    // Settle sender: use their pre-transfer balance.
    let sender_balance = ctx.accounts.source_token.amount;
    let sender = &mut ctx.accounts.sender_contributor;
    if let Ok(pending) = sender.pending_rewards(sender_balance, current_rpt) {
        sender.rewards_owed = sender.rewards_owed.saturating_add(pending);
        sender.reward_per_token_paid = current_rpt;
    }

    // Settle receiver: use their pre-transfer balance (before receiving `amount`).
    let receiver_balance = ctx.accounts.destination_token.amount;
    let receiver = &mut ctx.accounts.receiver_contributor;
    if let Ok(pending) = receiver.pending_rewards(receiver_balance, current_rpt) {
        receiver.rewards_owed = receiver.rewards_owed.saturating_add(pending);
        receiver.reward_per_token_paid = current_rpt;
    }

    let _ = amount;
    Ok(())
}
