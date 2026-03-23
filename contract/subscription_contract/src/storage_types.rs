use soroban_sdk::{contracttype, contracterror, Address, String, Vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    TokenAddress,
    SubscriptionPlan(u32),
    UserSubscription(Address),
    FamilyPlan(Address),
    MemberToOwner(Address), // Member -> Owner mapping
    GracePeriod,
    NextPlanId,
    NextSubscriptionId,
    PausedSubscription(Address),
    GiftedSubscription(u64),
}

#[derive(Clone, Copy, PartialEq)]
#[contracttype]
pub enum SubscriptionTier {
    Monthly,
    Annual,
}

#[derive(Clone, Copy, PartialEq)]
#[contracttype]
pub enum SubscriptionStatus {
    Active,
    Paused,
    Cancelled,
    Expired,
    GracePeriod,
}

#[derive(Clone)]
#[contracttype]
pub struct SubscriptionPlan {
    pub plan_id: u32,
    pub tier: SubscriptionTier,
    pub price: i128,
    pub duration_days: u32,
    pub category_ids: Vec<u32>,
    pub max_family_members: u32,
    pub is_active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct UserSubscription {
    pub subscription_id: u64,
    pub user: Address,
    pub plan_id: u32,
    pub status: SubscriptionStatus,
    pub start_date: u64,
    pub end_date: u64,
    pub last_payment_date: u64,
    pub auto_renew: bool,
    pub is_family_plan: bool,
    pub family_members: Vec<Address>,
}

#[derive(Clone)]
#[contracttype]
pub struct PausedSubscriptionData {
    pub paused_at: u64,
    pub remaining_days: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct GiftSubscription {
    pub gift_id: u64,
    pub from: Address,
    pub to: Address,
    pub plan_id: u32,
    pub claimed: bool,
    pub created_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SubscriptionError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    PlanNotFound = 4,
    PlanNotActive = 5,
    SubscriptionNotFound = 6,
    SubscriptionAlreadyActive = 7,
    SubscriptionNotPaused = 8,
    CannotRenewCancelled = 9,
    MaxFamilyMembersReached = 10,
    MemberAlreadyAdded = 11,
    MemberNotFound = 12,
    GiftNotFound = 13,
    GiftNotForUser = 14,
    GiftAlreadyClaimed = 15,
    InsufficientBalance = 16,
    TransferFailed = 17,
    InvalidAmount = 18,
    ContractPaused = 19,
}
