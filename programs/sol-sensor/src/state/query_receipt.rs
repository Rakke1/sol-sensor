use anchor_lang::prelude::*;

/// Slots before an unconsumed QueryReceipt becomes refundable by the original payer.
/// ~30 seconds at the ~400 ms/slot rate on devnet 2.1.x.
pub const RECEIPT_EXPIRY_SLOTS: u64 = 75;

/// Ephemeral payment receipt created by `pay_for_query` and closed (rent refunded)
/// by either `consume_receipt` or `refund_expired_receipt`.
///
/// Seeds: `["receipt", nonce]`
#[account]
pub struct QueryReceipt {
    /// The sensor whose data was purchased.
    pub sensor_id: Pubkey,
    /// Wallet that paid for the query.
    pub payer: Pubkey,
    /// Amount paid in USDC micro-units.
    pub amount: u64,
    /// Whether the receipt has already been consumed by the API co-signer.
    pub consumed: bool,
    /// Unix timestamp at the time of payment.
    pub created_at: i64,
    /// Absolute slot after which the receipt may be refunded.
    pub expiry_slot: u64,
    /// PDA bump.
    pub bump: u8,
}

impl QueryReceipt {
    /// Anchor discriminator (8) + sensor_id (32) + payer (32) + amount (8) +
    /// consumed (1) + created_at (8) + expiry_slot (8) + bump (1)
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 8 + 8 + 1;
    pub const SEEDS_PREFIX: &'static [u8] = b"receipt";

    /// Returns `true` if the receipt can still be consumed by the API co-signer.
    pub fn is_valid(&self, current_slot: u64) -> bool {
        !self.consumed && current_slot <= self.expiry_slot
    }

    /// Returns `true` if the receipt has expired and the payer can request a refund.
    pub fn is_expired(&self, current_slot: u64) -> bool {
        !self.consumed && current_slot > self.expiry_slot
    }
}
