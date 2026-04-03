use anchor_lang::prelude::*;

use crate::{
    errors::SolSensorError,
    state::{GlobalState, QueryReceipt},
};

/// Accounts required to consume a QueryReceipt.
#[derive(Accounts)]
pub struct ConsumeReceipt<'info> {
    /// The API co-signer — must match `global_state.consume_authority`.
    pub consume_authority: Signer<'info>,

    /// Global protocol state (verifies consume authority).
    #[account(
        seeds = [GlobalState::SEEDS],
        bump = global_state.bump,
        constraint = global_state.consume_authority == consume_authority.key()
            @ SolSensorError::UnauthorisedConsumeAuthority,
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The payment receipt PDA to consume and close.
    #[account(
        mut,
        seeds = [QueryReceipt::SEEDS_PREFIX, &query_receipt.to_account_info().key().to_bytes()],
        bump = query_receipt.bump,
        constraint = !query_receipt.consumed @ SolSensorError::ReceiptAlreadyConsumed,
        close = payer,
    )]
    pub query_receipt: Account<'info, QueryReceipt>,

    /// Original payer — receives the receipt account rent back.
    /// CHECK: verified via `query_receipt.payer`.
    #[account(mut, address = query_receipt.payer)]
    pub payer: UncheckedAccount<'info>,

    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

/// Mark a QueryReceipt as consumed and close the PDA (refunding rent to the payer).
///
/// Only the designated `consume_authority` (the API co-signer) can call this.
pub fn handler(ctx: Context<ConsumeReceipt>) -> Result<()> {
    let clock = &ctx.accounts.clock;
    let query_receipt = &mut ctx.accounts.query_receipt;

    require!(
        query_receipt.is_valid(clock.slot),
        SolSensorError::ReceiptExpired
    );

    query_receipt.consumed = true;
    Ok(())
}
