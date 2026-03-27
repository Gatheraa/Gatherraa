#![no_std]
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
/// Standard error set for the Staking Contract ecosystem.
pub enum StakingError {
    /// Contract is already initialized.
    AlreadyInitialized = 200,
    /// Contract is not yet initialized.
    NotInitialized = 201,
    /// Caller is not authorized for this operation.
    Unauthorized = 202,
    /// Provided token address is invalid or not a contract.
    InvalidToken = 203,
    /// Insufficient account balance for the transaction.
    InsufficientBalance = 204,
    /// Amount must be greater than zero.
    AmountMustBePositive = 205,
    /// Staked amount does not meet the minimum requirement for the selected tier.
    InsufficientAmountForTier = 206,
    /// Reward token must be identical to staking token for compounding.
    RewardTokenDiffers = 207,
    /// Tokens are still within the mandatory lock period.
    LockPeriodNotExpired = 208,
    /// Internal arithmetic operation resulted in overflow/underflow.
    ArithmeticOverflow = 209,
    /// Specified tier ID does not exist in the contract.
    InvalidTier = 210,
    /// User record not found in storage.
    UserNotFound = 211,
    /// Timelock for the scheduled upgrade has not yet expired.
    UpgradeTimelockNotExpired = 212,
    /// Provided WASM hash does not match the scheduled upgrade.
    UpgradeHashMismatch = 213,
    /// No upgrade has been scheduled.
    NoUpgradeScheduled = 214,
    /// New version number must be strictly greater than current version.
    NewVersionMustBeGreater = 215,
    /// Slashing amount cannot exceed the user's current stake.
    SlashingAmountExceedsBalance = 216,
    /// Compounding is only supported when rewards are in the same token as stake.
    CompoundDisabledForDifferentToken = 217,
}
