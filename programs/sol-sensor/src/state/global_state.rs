use anchor_lang::prelude::*;

/// Singleton account holding protocol-wide configuration.
///
/// Seeds: `["global"]`
#[account]
#[derive(Default)]
pub struct GlobalState {
    /// The admin wallet that can update protocol parameters.
    pub admin: Pubkey,
    /// The API server's keypair address that is authorised to call
    /// `consume_receipt`.
    pub consume_authority: Pubkey,
    /// Cumulative count of all sensors ever registered.
    pub total_sensors: u32,
    /// Cumulative count of all queries ever paid for.
    pub total_queries: u64,
    /// PDA bump.
    pub bump: u8,
}

impl GlobalState {
    /// Anchor discriminator (8) + admin (32) + consume_authority (32) +
    /// total_sensors (4) + total_queries (8) + bump (1)
    pub const LEN: usize = 8 + 32 + 32 + 4 + 8 + 1;
    pub const SEEDS: &'static [u8] = b"global";
}
