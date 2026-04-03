use anchor_lang::prelude::*;

#[error_code]
pub enum SolSensorError {
    /// The sensor model ID is not in the allowed list.
    #[msg("Unknown sensor model ID")]
    UnknownModel,

    /// The pool has already been initialised.
    #[msg("Pool is already initialised")]
    AlreadyInitialised,

    /// Minting would exceed the hard-coded supply cap.
    #[msg("Pool token supply cap exceeded")]
    SupplyCapExceeded,

    /// The QueryReceipt has already been consumed.
    #[msg("Receipt already consumed")]
    ReceiptAlreadyConsumed,

    /// The QueryReceipt has not yet expired.
    #[msg("Receipt has not expired yet")]
    ReceiptNotExpired,

    /// The QueryReceipt has already expired and cannot be consumed by the API.
    #[msg("Receipt has expired")]
    ReceiptExpired,

    /// Caller is not the designated consume authority.
    #[msg("Unauthorised: not the consume authority")]
    UnauthorisedConsumeAuthority,

    /// The sensor_id in the receipt does not match the provided sensor account.
    #[msg("Sensor ID mismatch")]
    SensorIdMismatch,

    /// The payment amount is below the minimum required for this sensor.
    #[msg("Payment amount is too low")]
    InsufficientPayment,

    /// Arithmetic overflow during reward accumulator update.
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    /// The hardware entry is not active (deregistered or suspended).
    #[msg("Hardware sensor is not active")]
    SensorNotActive,

    /// Contributor account is not initialised.
    #[msg("Contributor state not initialised")]
    ContributorNotInitialised,

    /// No rewards are available to claim.
    #[msg("No rewards to claim")]
    NoRewardsToClaim,

    /// Transfer Hook — ExtraAccountMetaList not properly configured.
    #[msg("Invalid extra account meta list")]
    InvalidExtraAccountMetaList,
}
