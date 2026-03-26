use soroban_sdk::{contracttype, Address, BytesN};

/// Storage keys for the Whitelist (Airdrop) Contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The administrator address.
    Admin,
    /// Configuration for a specific campaign: [u32] (Campaign ID).
    Campaign(u32),
    /// Tracking for whether a user has already claimed from a campaign: [(u32, Address)].
    Claimed(u32, Address),
    /// Global counter for created campaigns.
    CampaignCount,
    /// Optional delegation mapping for claims: [(u32, Address)].
    Delegate(u32, Address),
}

/// Represents a specific whitelist or airdrop event.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    /// The manager of this specific campaign.
    pub admin: Address,
    /// The token being distributed.
    pub token: Address,
    /// Merkle root of the whitelist addresses.
    pub root: BytesN<32>,
    /// Total amount of tokens deposited for this campaign.
    pub total_amount: i128,
    /// Cumulative amount already claimed by users.
    pub claimed_amount: i128,
    /// Timestamp after which claims are no longer allowed.
    pub deadline: u64,
    /// Whether the campaign is currently open for claims.
    pub is_active: bool,
    /// Whether the remaining funds have been refunded to the campaign admin.
    pub refunded: bool,
}
