use anchor_lang::prelude::*;

/// Allowed hardware sensor models with their on-chain identifiers, USDC
/// registration fees (in micro-units, 6-decimal USDC), and the number of
/// pool tokens minted per registration.
///
/// model_id → (display_name, registration_fee_usdc_micro, tokens_minted)
pub const SENSOR_MODELS: [(u8, &str, u64, u64); 3] = [
    (1, "SenseCAP S2103", 150_000_000, 1_500), // $150 → 1 500 tokens
    (2, "RAKwireless RAK7204", 80_000_000, 800), // $80  →   800 tokens
    (3, "Mock Dev Sensor", 5_000_000, 50),       // $5   →    50 tokens (testing)
];

/// On-chain record for a registered hardware sensor.
///
/// Seeds: `["hw", sensor_pubkey]`
#[account]
pub struct HardwareEntry {
    /// Wallet that registered (and owns) this sensor.
    pub owner: Pubkey,
    /// The sensor device's Ed25519 public key.
    pub sensor_pubkey: Pubkey,
    /// Model identifier — validated against [`SENSOR_MODELS`].
    pub model_id: u8,
    /// Whether the sensor is currently active and eligible for revenue.
    pub is_active: bool,
    /// Unix timestamp of registration.
    pub registered_at: i64,
    /// USDC registration fee paid (in micro-units).
    pub registration_fee: u64,
    /// PDA bump.
    pub bump: u8,
}

impl HardwareEntry {
    /// Anchor discriminator (8) + owner (32) + sensor_pubkey (32) + model_id (1) +
    /// is_active (1) + registered_at (8) + registration_fee (8) + bump (1)
    pub const LEN: usize = 8 + 32 + 32 + 1 + 1 + 8 + 8 + 1;
    pub const SEEDS_PREFIX: &'static [u8] = b"hw";

    /// Look up model metadata by `model_id`.  Returns `None` for unknown IDs.
    pub fn model_info(model_id: u8) -> Option<(u64, u64)> {
        SENSOR_MODELS
            .iter()
            .find(|(id, _, _, _)| *id == model_id)
            .map(|(_, _, fee, tokens)| (*fee, *tokens))
    }
}
