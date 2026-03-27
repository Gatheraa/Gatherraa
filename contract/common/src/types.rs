/// Shared primitive type aliases and newtypes for all Gatherraa contracts.
///
/// Using named aliases instead of raw primitives makes function signatures and
/// struct fields self-documenting, prevents accidental parameter swaps, and
/// centralises the mapping between domain concepts and underlying storage types.

// ─── Primitive domain aliases ────────────────────────────────────────────────

/// A Unix timestamp expressed in seconds (maps to `u64`).
///
/// Use this wherever a field or parameter represents a point in time.
pub type Timestamp = u64;

/// A ledger sequence number (maps to `u32`).
///
/// Used for on-chain timing (voting periods, timelocks, etc.).
pub type LedgerSequence = u32;

/// A token amount expressed in the token's smallest indivisible unit (maps to `i128`).
///
/// All balances, prices, fees, and reward amounts should use this alias.
pub type TokenAmount = i128;

/// A value expressed in basis points, where 10_000 bps == 100% (maps to `u32`).
///
/// Use for fee rates, discount rates, reward multipliers and similar ratios.
pub type BasisPoints = u32;

/// A percentage value in the range [0, 100] (maps to `u32`).
///
/// Distinct from `BasisPoints` to make the intended scale unambiguous.
pub type Percentage = u32;

// ─── Domain ID aliases ───────────────────────────────────────────────────────

/// Unique numeric identifier for a governance proposal (maps to `u32`).
pub type ProposalId = u32;

/// Unique numeric identifier for a subscription plan (maps to `u32`).
pub type PlanId = u32;

/// Unique numeric identifier for a subscription instance (maps to `u64`).
pub type SubscriptionId = u64;

/// Unique numeric identifier for a gift subscription (maps to `u64`).
pub type GiftId = u64;

/// Unique numeric identifier for a claim attached to a DID (maps to `u32`).
pub type ClaimId = u32;

/// Unique numeric identifier for a milestone within an escrow (maps to `u32`).
pub type MilestoneId = u32;

/// Unique numeric identifier for a staking reward tier (maps to `u32`).
pub type TierId = u32;

/// Unique numeric identifier for a governance category (maps to `u32`).
pub type CategoryId = u32;

/// Unique numeric identifier for a signer weight / M-of-N threshold (maps to `u32`).
pub type SignerWeight = u32;

// ─── Duration aliases ────────────────────────────────────────────────────────

/// A duration expressed in seconds (maps to `u64`).
///
/// Prefer this over `Timestamp` when a value represents a *length of time*
/// rather than a *point in time*.
pub type DurationSeconds = u64;

/// A duration expressed in days (maps to `u32`).
pub type DurationDays = u32;

/// A duration expressed in ledger sequences (maps to `u32`).
pub type DurationLedgers = u32;

// ─── Score / quality aliases ─────────────────────────────────────────────────

/// A reputation or quality score in the range [0, 100] (maps to `u32`).
pub type ReputationScore = u32;

/// A selection weight used when randomly sampling entropy providers (maps to `u32`).
pub type ProviderWeight = u32;
