use soroban_sdk::{contracttype, Address, Vec, String};
use gathera_common::types::{
    Timestamp, LedgerSequence, TokenAmount, BasisPoints, Percentage,
    ProposalId, CategoryId,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    TimelockDuration,
    EmergencyAddress,
    Proposal(ProposalId),
    ProposalCount,
    Vote(ProposalId, Address), // (ProposalID, Voter)
    UserDelegation(Address), // User -> Delegatee
    UserVotesRevoked(ProposalId, Address),
    CategorySettings(CategoryId), // CategoryID -> CategorySettings
}

#[derive(Clone)]
#[contracttype]
pub struct CategorySettings {
    /// Minimum token votes required for the proposal to be valid.
    pub quorum: TokenAmount,
    /// Percentage of 'for' votes needed to pass (e.g. 51, 66).
    pub threshold: Percentage,
    /// Voting duration in ledger sequences.
    pub voting_period: LedgerSequence,
}


#[derive(Clone)]
#[contracttype]
pub enum GovernanceAction {
    Upgrade(String), // New WASM hash
    FeeChange(BasisPoints),  // New fee in basis points
    ParameterChange(String, u32), // Param name, new value
    EmergencyAction,
}

#[derive(Clone)]
#[contracttype]
pub enum ProposalCategory {
    ProtocolUpgrade,
    FeeAdjustment,
    ParameterUpdate,
    Emergency,
}

#[derive(Clone)]
#[contracttype]
pub enum ProposalStatus {
    Pending,
    Active,
    Defeated,
    Succeeded,
    Queued,
    Executed,
    Canceled,
    Expired,
}

#[derive(Clone)]
#[contracttype]
pub struct Proposal {
    pub id: ProposalId,
    pub proposer: Address,
    pub action: GovernanceAction,
    pub category: ProposalCategory,
    pub description: String,
    pub start_ledger: LedgerSequence,
    pub end_ledger: LedgerSequence,
    pub total_votes_for: TokenAmount,
    pub total_votes_against: TokenAmount,
    pub status: ProposalStatus,
    /// Estimated execution time (Unix seconds) after the proposal is queued.
    pub eta: Timestamp,
}

#[derive(Clone)]
#[contracttype]
pub struct VoteRecord {
    pub voter: Address,
    pub support: bool,
    pub amount: TokenAmount,
    pub is_quadratic: bool,
}
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GovernanceError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ProposalNotFound = 4,
    InvalidProposal = 5,
    VotingEnded = 6,
    InsufficientBalance = 7,
    InvalidAmount = 8,
    AlreadyVoted = 9,
    NotDelegatee = 10,
    InvalidDelegatee = 11,
    VotingStillActive = 12,
    ProposalNotQueued = 13,
    TimelockNotExpired = 14,
    CategorySettingsNotFound = 15,
    ArithmeticError = 16,
}
