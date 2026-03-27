use soroban_sdk::{token, Address, Env};

use crate::storage_types::*;
use crate::utils::SECONDS_PER_DAY;

/// Process subscription payment using Soroban token
pub fn process_subscription_payment(env: &Env, user: &Address, plan: &SubscriptionPlan) {
    let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

    let token_client = token::TokenClient::new(env, &token_address);
    
    // Transfer tokens from user to contract admin
    token_client.transfer(user, &admin, &plan.price);
}

/// Process refund to user
pub fn process_refund(env: &Env, user: &Address, amount: i128) {
    if amount <= 0 {
        return;
    }

    let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

    let token_client = token::TokenClient::new(env, &token_address);
    
    // Transfer tokens from admin back to user
    token_client.transfer(&admin, user, &amount);
}

/// Calculate prorated refund amount based on remaining subscription time
pub fn calculate_prorated_refund(
    env: &Env,
    subscription: &UserSubscription,
    plan: &SubscriptionPlan,
) -> i128 {
    let current_time = env.ledger().timestamp();
    
    if current_time >= subscription.end_date {
        return 0;
    }

    let total_duration = subscription.end_date - subscription.start_date;
    let remaining_duration = subscription.end_date - current_time;

    if total_duration == 0 {
        return 0;
    }

    // Calculate prorated refund: (remaining_time / total_time) * price
    let refund = (plan.price * remaining_duration as i128) / total_duration as i128;
    
    refund
}

/// Calculate amount for plan change (upgrade/downgrade)
pub fn calculate_plan_change_amount(
    env: &Env,
    subscription: &UserSubscription,
    old_plan: &SubscriptionPlan,
    new_plan: &SubscriptionPlan,
) -> i128 {
    let current_time = env.ledger().timestamp();
    
    if current_time >= subscription.end_date {
        // Subscription expired, charge full new plan price
        return new_plan.price;
    }

    let total_duration = subscription.end_date - subscription.start_date;
    let remaining_duration = subscription.end_date - current_time;

    if total_duration == 0 {
        return new_plan.price;
    }

    // Calculate remaining value of old plan
    let old_plan_remaining_value = (old_plan.price * remaining_duration as i128) / total_duration as i128;
    
    // Calculate prorated value of new plan for remaining time
    let new_plan_prorated_value = (new_plan.price * remaining_duration as i128) / (new_plan.duration_days as i128 * SECONDS_PER_DAY as i128);

    // Positive means upgrade (user pays), negative means downgrade (user gets refund)
    new_plan_prorated_value - old_plan_remaining_value
}

/// Check if payment is due for renewal
pub fn is_payment_due(env: &Env, subscription: &UserSubscription) -> bool {
    let current_time = env.ledger().timestamp();
    
    // Check if subscription is about to expire (within 1 day)
    if subscription.auto_renew && subscription.status == SubscriptionStatus::Active {
        let time_until_expiry = subscription.end_date.saturating_sub(current_time);
        return time_until_expiry <= SECONDS_PER_DAY; // 1 day in seconds
    }
    
    false
}

/// Validate subscription can be modified
pub fn validate_subscription_modification(subscription: &UserSubscription) -> Result<(), &'static str> {
    match subscription.status {
        SubscriptionStatus::Active => Ok(()),
        SubscriptionStatus::GracePeriod => Ok(()),
        SubscriptionStatus::Cancelled => Err("Subscription is cancelled"),
        SubscriptionStatus::Expired => Err("Subscription is expired"),
        SubscriptionStatus::Paused => Err("Subscription is paused"),
    }
}

/// Calculate days remaining in subscription
pub fn calculate_remaining_days(env: &Env, subscription: &UserSubscription) -> u32 {
    let current_time = env.ledger().timestamp();
    
    if current_time >= subscription.end_date {
        return 0;
    }

    let remaining_seconds = subscription.end_date - current_time;
    (remaining_seconds / SECONDS_PER_DAY) as u32
}
