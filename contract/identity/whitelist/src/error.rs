#![no_std]
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
/// Standard error set for the Whitelist & Merkle Campaign ecosystem.
pub enum WhitelistError {
    /// Contract is already initialized.
    AlreadyInitialized = 300,
    /// Contract is not yet initialized.
    NotInitialized = 301,
    /// Caller is not authorized for this operation.
    Unauthorized = 302,
    /// Specified campaign ID was not found.
    CampaignNotFound = 303,
    /// Campaign is currently marked as inactive.
    CampaignInactive = 304,
    /// Campaign has reached or passed its deadline.
    CampaignExpired = 305,
    /// User has already successfully claimed their allocation.
    AlreadyClaimed = 306,
    /// Provided Merkle proof is invalid for the leaf/root.
    InvalidProof = 307,
    /// Campaign pool does not have sufficient tokens for this claim.
    InsufficientFundsInCampaign = 308,
    /// Input vector lengths do not match (e.g., in batch operations).
    MismatchedLengths = 309,
    /// Internal arithmetic operation resulted in overflow/underflow.
    ArithmeticError = 310,
    /// No delegation record found for the given delegator/campaign.
    NoDelegationFound = 311,
    /// Caller is not the authorized delegate for this claim.
    UnauthorizedDelegate = 312,
    /// Campaign is still active/ongoing, refund not yet available.
    CampaignNotYetFinished = 313,
    /// Refund for this campaign has already been processed.
    AlreadyRefunded = 314,
}
