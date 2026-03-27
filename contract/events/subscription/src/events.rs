use soroban_sdk::{contracttype, Address, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionCreatedEvent {
    pub subscription_id: u64,
    pub user: Address,
    pub plan_id: u32,
    pub end_date: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionRenewedEvent {
    pub subscription_id: u64,
    pub user: Address,
    pub new_end_date: u64,
    pub amount_paid: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionCancelledEvent {
    pub subscription_id: u64,
    pub user: Address,
    pub refund_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionPausedEvent {
    pub subscription_id: u64,
    pub user: Address,
    pub paused_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionResumedEvent {
    pub subscription_id: u64,
    pub user: Address,
    pub new_end_date: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct SubscriptionUpgradedEvent {
    pub subscription_id: u64,
    pub user: Address,
    pub old_plan_id: u32,
    pub new_plan_id: u32,
    pub prorated_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct FamilyMemberAddedEvent {
    pub subscription_id: u64,
    pub owner: Address,
    pub member: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct GiftSubscriptionCreatedEvent {
    pub gift_id: u64,
    pub from: Address,
    pub to: Address,
    pub plan_id: u32,
}

pub fn emit_subscription_created(
    env: &soroban_sdk::Env,
    event: SubscriptionCreatedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "subscription_created"),),
        event,
    );
}

pub fn emit_subscription_renewed(
    env: &soroban_sdk::Env,
    event: SubscriptionRenewedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "subscription_renewed"),),
        event,
    );
}

pub fn emit_subscription_cancelled(
    env: &soroban_sdk::Env,
    event: SubscriptionCancelledEvent,
) {
    env.events().publish(
        (Symbol::new(env, "subscription_cancelled"),),
        event,
    );
}

pub fn emit_subscription_paused(
    env: &soroban_sdk::Env,
    event: SubscriptionPausedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "subscription_paused"),),
        event,
    );
}

pub fn emit_subscription_resumed(
    env: &soroban_sdk::Env,
    event: SubscriptionResumedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "subscription_resumed"),),
        event,
    );
}

pub fn emit_subscription_upgraded(
    env: &soroban_sdk::Env,
    event: SubscriptionUpgradedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "subscription_upgraded"),),
        event,
    );
}

pub fn emit_family_member_added(
    env: &soroban_sdk::Env,
    event: FamilyMemberAddedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "family_member_added"),),
        event,
    );
}

pub fn emit_gift_subscription_created(
    env: &soroban_sdk::Env,
    event: GiftSubscriptionCreatedEvent,
) {
    env.events().publish(
        (Symbol::new(env, "gift_created"),),
        event,
    );
}
