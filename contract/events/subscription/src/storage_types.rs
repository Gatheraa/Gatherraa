use soroban_sdk::{contracttype, Address, String, Vec};
use gathera_common::types::{
    Timestamp, TokenAmount, Percentage, PlanId, SubscriptionId, GiftId, DurationDays,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    TokenAddress,
    SubscriptionPlan(PlanId),
    UserSubscription(Address),
    FamilyPlan(Address),
    GracePeriod,
    NextPlanId,
    NextSubscriptionId,
    PausedSubscription(Address),
    GiftedSubscription(GiftId),
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
    pub plan_id: PlanId,
    pub tier: SubscriptionTier,
    /// Price in the smallest token unit.
    pub price: TokenAmount,
    pub duration_days: DurationDays,
    pub category_ids: Vec<u32>,
    pub max_family_members: u32,
    pub is_active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct UserSubscription {
    pub subscription_id: SubscriptionId,
    pub user: Address,
    pub plan_id: PlanId,
    pub status: SubscriptionStatus,
    pub start_date: Timestamp,
    pub end_date: Timestamp,
    pub last_payment_date: Timestamp,
    pub auto_renew: bool,
    pub is_family_plan: bool,
    pub family_members: Vec<Address>,
}

#[derive(Clone)]
#[contracttype]
pub struct PausedSubscriptionData {
    pub paused_at: Timestamp,
    pub remaining_days: DurationDays,
}

#[derive(Clone)]
#[contracttype]
pub struct GiftSubscription {
    pub gift_id: GiftId,
    pub from: Address,
    pub to: Address,
    pub plan_id: PlanId,
    pub claimed: bool,
    pub created_at: Timestamp,
}
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SubscriptionError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    PlanNotFound = 3,
    SubscriptionNotFound = 4,
    ActiveSubscriptionExists = 5,
    PlanNotActive = 6,
    InsufficientBalance = 7,
    InvalidAmount = 8,
    CancellationNotAllowed = 9,
    PauseNotAllowed = 10,
    NotPaused = 11,
    GiftNotFound = 12,
    GiftNotForUser = 13,
    GiftAlreadyClaimed = 14,
    GracePeriodExpired = 15,
    ArithmeticError = 16,
}
