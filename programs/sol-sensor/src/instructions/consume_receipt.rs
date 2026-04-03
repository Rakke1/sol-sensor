use anchor_lang::prelude::*;

use crate::{
    errors::SolSensorError,
    state::{GlobalState, QueryReceipt},
};

/// Accounts required to consume a QueryReceipt.
#[derive(Accounts)]
#[instruction(nonce: [u8; 32])]
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
    /// Seeds: ["receipt", nonce] — same seeds used in pay_for_query.
    #[account(
        mut,
        seeds = [QueryReceipt::SEEDS_PREFIX, &nonce],
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
/// The receipt must not be expired — callers should check the slot before calling.
pub fn handler(ctx: Context<ConsumeReceipt>, _nonce: [u8; 32]) -> Result<()> {
    let clock = &ctx.accounts.clock;
    let query_receipt = &mut ctx.accounts.query_receipt;

    // Reject expired receipts — the payer should use refund_expired_receipt instead.
    require!(
        query_receipt.is_valid(clock.slot),
        SolSensorError::ReceiptExpired
    );

    query_receipt.consumed = true;

    msg!(
        "receipt_consumed: receipt={}, payer={}",
        ctx.accounts.query_receipt.key(),
        ctx.accounts.payer.key()
    );

    Ok(())
}
