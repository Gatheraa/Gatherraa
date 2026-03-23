#![no_std]

mod events;
mod storage_types;
mod subscription;
mod utils;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};
use storage_types::*;

pub use subscription::*;
pub use utils::*;

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    /// Initialize the contract with admin and token address
    pub fn initialize(env: Env, admin: Address, token_address: Address, grace_period_days: u32) -> Result<(), SubscriptionError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(SubscriptionError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::GracePeriod, &grace_period_days);
        env.storage().instance().set(&DataKey::NextPlanId, &1u32);
        env.storage().instance().set(&DataKey::NextSubscriptionId, &1u64);
        Ok(())
    }

    /// Create a new subscription plan
    pub fn create_plan(
        env: Env,
        tier: SubscriptionTier,
        price: i128,
        duration_days: u32,
        category_ids: Vec<u32>,
        max_family_members: u32,
    ) -> Result<u32, SubscriptionError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(SubscriptionError::NotInitialized)?;
        admin.require_auth();

        let plan_id: u32 = env.storage().instance().get(&DataKey::NextPlanId).unwrap_or(1);
        
        let plan = SubscriptionPlan {
            plan_id,
            tier,
            price,
            duration_days,
            category_ids,
            max_family_members,
            is_active: true,
        };

        env.storage().persistent().set(&DataKey::SubscriptionPlan(plan_id), &plan);
        env.storage().instance().set(&DataKey::NextPlanId, &(plan_id + 1));

        Ok(plan_id)
    }

    /// Update an existing subscription plan
    pub fn update_plan(
        env: Env,
        plan_id: u32,
        price: i128,
        category_ids: Vec<u32>,
        is_active: bool,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(plan_id))
            .expect("Plan not found");

        plan.price = price;
        plan.category_ids = category_ids;
        plan.is_active = is_active;

        env.storage().persistent().set(&DataKey::SubscriptionPlan(plan_id), &plan);
    }

    /// Subscribe to a plan
    pub fn subscribe(env: Env, user: Address, plan_id: u32) -> Result<u64, SubscriptionError> {
        user.require_auth();

        let plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(plan_id))
            .ok_or(SubscriptionError::PlanNotFound)?;

        if !plan.is_active {
            return Err(SubscriptionError::PlanNotActive);
        }

        // Check if user already has an active subscription
        if let Some(existing_sub) = env
            .storage()
            .persistent()
            .get::<DataKey, UserSubscription>(&DataKey::UserSubscription(user.clone()))
        {
            if existing_sub.status == SubscriptionStatus::Active {
                return Err(SubscriptionError::SubscriptionAlreadyActive);
            }
        }

        subscription::process_subscription_payment(&env, &user, &plan);

        let subscription_id: u64 = env.storage().instance().get(&DataKey::NextSubscriptionId).unwrap();
        let current_time = env.ledger().timestamp();
        let end_date = current_time + (plan.duration_days as u64 * 86400);

        let subscription = UserSubscription {
            subscription_id,
            user: user.clone(),
            plan_id,
            status: SubscriptionStatus::Active,
            start_date: current_time,
            end_date,
            last_payment_date: current_time,
            auto_renew: true,
            is_family_plan: false,
            family_members: Vec::new(&env),
        };

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);
        env.storage().instance().set(&DataKey::NextSubscriptionId, &(subscription_id + 1));

        events::emit_subscription_created(
            &env,
            events::SubscriptionCreatedEvent {
                subscription_id,
                user,
                plan_id,
                end_date,
            },
        );

        Ok(subscription_id)
    }

    /// Renew subscription (can be called manually or automatically)
    pub fn renew_subscription(env: Env, user: Address) {
        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        if subscription.status == SubscriptionStatus::Cancelled {
            panic!("Cannot renew cancelled subscription");
        }

        let plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(subscription.plan_id))
            .expect("Plan not found");

        subscription::process_subscription_payment(&env, &user, &plan);

        let current_time = env.ledger().timestamp();
        subscription.end_date = current_time + (plan.duration_days as u64 * 86400);
        subscription.last_payment_date = current_time;
        subscription.status = SubscriptionStatus::Active;

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);

        events::emit_subscription_renewed(
            &env,
            events::SubscriptionRenewedEvent {
                subscription_id: subscription.subscription_id,
                user,
                new_end_date: subscription.end_date,
                amount_paid: plan.price,
            },
        );
    }

    /// Cancel subscription with prorated refund
    pub fn cancel_subscription(env: Env, user: Address) {
        user.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        if subscription.status == SubscriptionStatus::Cancelled {
            panic!("Subscription already cancelled");
        }

        let plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(subscription.plan_id))
            .expect("Plan not found");

        let refund_amount = subscription::calculate_prorated_refund(
            &env,
            &subscription,
            &plan,
        );

        if refund_amount > 0 {
            subscription::process_refund(&env, &user, refund_amount);
        }

        subscription.status = SubscriptionStatus::Cancelled;
        subscription.auto_renew = false;

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);

        events::emit_subscription_cancelled(
            &env,
            events::SubscriptionCancelledEvent {
                subscription_id: subscription.subscription_id,
                user,
                refund_amount,
            },
        );
    }

    /// Pause subscription
    pub fn pause_subscription(env: Env, user: Address) {
        user.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        if subscription.status != SubscriptionStatus::Active {
            panic!("Can only pause active subscriptions");
        }

        let current_time = env.ledger().timestamp();
        let remaining_days = ((subscription.end_date - current_time) / 86400) as u32;

        let paused_data = PausedSubscriptionData {
            paused_at: current_time,
            remaining_days,
        };

        subscription.status = SubscriptionStatus::Paused;
        subscription.auto_renew = false;

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);
        env.storage().persistent().set(&DataKey::PausedSubscription(user.clone()), &paused_data);

        events::emit_subscription_paused(
            &env,
            events::SubscriptionPausedEvent {
                subscription_id: subscription.subscription_id,
                user,
                paused_at: current_time,
            },
        );
    }

    /// Resume paused subscription
    pub fn resume_subscription(env: Env, user: Address) {
        user.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        if subscription.status != SubscriptionStatus::Paused {
            panic!("Subscription is not paused");
        }

        let paused_data: PausedSubscriptionData = env
            .storage()
            .persistent()
            .get(&DataKey::PausedSubscription(user.clone()))
            .expect("Paused data not found");

        let current_time = env.ledger().timestamp();
        let new_end_date = current_time + (paused_data.remaining_days as u64 * 86400);

        subscription.status = SubscriptionStatus::Active;
        subscription.end_date = new_end_date;
        subscription.auto_renew = true;

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);
        env.storage().persistent().remove(&DataKey::PausedSubscription(user.clone()));

        events::emit_subscription_resumed(
            &env,
            events::SubscriptionResumedEvent {
                subscription_id: subscription.subscription_id,
                user,
                new_end_date,
            },
        );
    }

    /// Upgrade or downgrade subscription
    pub fn change_plan(env: Env, user: Address, new_plan_id: u32) {
        user.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        if subscription.status != SubscriptionStatus::Active {
            panic!("Can only change active subscriptions");
        }

        let old_plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(subscription.plan_id))
            .expect("Old plan not found");

        let new_plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(new_plan_id))
            .expect("New plan not found");

        if !new_plan.is_active {
            panic!("New plan is not active");
        }

        let prorated_amount = subscription::calculate_plan_change_amount(
            &env,
            &subscription,
            &old_plan,
            &new_plan,
        );

        if prorated_amount > 0 {
            // Upgrade - charge difference
            subscription::process_subscription_payment(&env, &user, &new_plan);
        } else if prorated_amount < 0 {
            // Downgrade - refund difference
            subscription::process_refund(&env, &user, -prorated_amount);
        }

        let old_plan_id = subscription.plan_id;
        subscription.plan_id = new_plan_id;

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);

        events::emit_subscription_upgraded(
            &env,
            events::SubscriptionUpgradedEvent {
                subscription_id: subscription.subscription_id,
                user,
                old_plan_id,
                new_plan_id,
                prorated_amount,
            },
        );
    }

    /// Add family member to subscription
    pub fn add_family_member(env: Env, owner: Address, member: Address) -> Result<(), SubscriptionError> {
        owner.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(owner.clone()))
            .ok_or(SubscriptionError::SubscriptionNotFound)?;

        if subscription.status != SubscriptionStatus::Active {
            return Err(SubscriptionError::SubscriptionNotFound);
        }

        let plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(subscription.plan_id))
            .ok_or(SubscriptionError::PlanNotFound)?;

        if subscription.family_members.len() >= plan.max_family_members {
            return Err(SubscriptionError::MaxFamilyMembersReached);
        }

        if subscription.family_members.contains(&member) {
            return Err(SubscriptionError::MemberAlreadyAdded);
        }

        subscription.family_members.push_back(member.clone());
        subscription.is_family_plan = true;

        env.storage().persistent().set(&DataKey::UserSubscription(owner.clone()), &subscription);
        env.storage().persistent().set(&DataKey::MemberToOwner(member.clone()), &owner);

        events::emit_family_member_added(
            &env,
            events::FamilyMemberAddedEvent {
                subscription_id: subscription.subscription_id,
                owner,
                member,
            },
        );
        Ok(())
    }

    /// Remove family member from subscription
    pub fn remove_family_member(env: Env, owner: Address, member: Address) -> Result<(), SubscriptionError> {
        owner.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(owner.clone()))
            .ok_or(SubscriptionError::SubscriptionNotFound)?;

        let member_index = subscription
            .family_members
            .iter()
            .position(|m| m == member)
            .ok_or(SubscriptionError::MemberNotFound)?;

        subscription.family_members.remove(member_index as u32);

        if subscription.family_members.is_empty() {
            subscription.is_family_plan = false;
        }

        env.storage().persistent().set(&DataKey::UserSubscription(owner), &subscription);
        env.storage().persistent().remove(&DataKey::MemberToOwner(member));
        Ok(())
    }

    /// Gift a subscription to another user
    pub fn gift_subscription(env: Env, from: Address, to: Address, plan_id: u32) -> u64 {
        from.require_auth();

        let plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(plan_id))
            .expect("Plan not found");

        if !plan.is_active {
            panic!("Plan is not active");
        }

        subscription::process_subscription_payment(&env, &from, &plan);

        let gift_id: u64 = env.ledger().timestamp();
        let gift = GiftSubscription {
            gift_id,
            from: from.clone(),
            to: to.clone(),
            plan_id,
            claimed: false,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::GiftedSubscription(gift_id), &gift);

        events::emit_gift_subscription_created(
            &env,
            events::GiftSubscriptionCreatedEvent {
                gift_id,
                from,
                to,
                plan_id,
            },
        );

        gift_id
    }

    /// Claim a gifted subscription
    pub fn claim_gift(env: Env, user: Address, gift_id: u64) -> u64 {
        user.require_auth();

        let mut gift: GiftSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::GiftedSubscription(gift_id))
            .expect("Gift not found");

        if gift.to != user {
            panic!("Gift not for this user");
        }

        if gift.claimed {
            panic!("Gift already claimed");
        }

        // Check if user already has an active subscription
        if let Some(existing_sub) = env
            .storage()
            .persistent()
            .get::<DataKey, UserSubscription>(&DataKey::UserSubscription(user.clone()))
        {
            if existing_sub.status == SubscriptionStatus::Active {
                panic!("User already has an active subscription");
            }
        }

        let plan: SubscriptionPlan = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionPlan(gift.plan_id))
            .expect("Plan not found");

        let subscription_id: u64 = env.storage().instance().get(&DataKey::NextSubscriptionId).unwrap();
        let current_time = env.ledger().timestamp();
        let end_date = current_time + (plan.duration_days as u64 * 86400);

        let subscription = UserSubscription {
            subscription_id,
            user: user.clone(),
            plan_id: gift.plan_id,
            status: SubscriptionStatus::Active,
            start_date: current_time,
            end_date,
            last_payment_date: current_time,
            auto_renew: false,
            is_family_plan: false,
            family_members: Vec::new(&env),
        };

        gift.claimed = true;

        env.storage().persistent().set(&DataKey::UserSubscription(user.clone()), &subscription);
        env.storage().persistent().set(&DataKey::GiftedSubscription(gift_id), &gift);
        env.storage().instance().set(&DataKey::NextSubscriptionId, &(subscription_id + 1));

        events::emit_subscription_created(
            &env,
            events::SubscriptionCreatedEvent {
                subscription_id,
                user,
                plan_id: gift.plan_id,
                end_date,
            },
        );

        subscription_id
    }

    /// Toggle auto-renewal
    pub fn set_auto_renew(env: Env, user: Address, auto_renew: bool) {
        user.require_auth();

        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        subscription.auto_renew = auto_renew;

        env.storage().persistent().set(&DataKey::UserSubscription(user), &subscription);
    }

    /// Check if subscription is active and handle grace period
    pub fn check_subscription_status(env: Env, user: Address) -> SubscriptionStatus {
        let mut subscription: UserSubscription = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscription(user.clone()))
            .expect("Subscription not found");

        let current_time = env.ledger().timestamp();

        if subscription.status == SubscriptionStatus::Active && current_time > subscription.end_date {
            let grace_period_days: u32 = env.storage().instance().get(&DataKey::GracePeriod).unwrap();
            let grace_period_end = subscription.end_date + (grace_period_days as u64 * 86400);

            if current_time <= grace_period_end {
                subscription.status = SubscriptionStatus::GracePeriod;
            } else {
                subscription.status = SubscriptionStatus::Expired;
                subscription.auto_renew = false;
            }

            env.storage().persistent().set(&DataKey::UserSubscription(user), &subscription);
        }

        subscription.status
    }

    /// Get user subscription details
    pub fn get_subscription(env: Env, user: Address) -> Option<UserSubscription> {
        env.storage().persistent().get(&DataKey::UserSubscription(user))
    }

    /// Get subscription plan details
    pub fn get_plan(env: Env, plan_id: u32) -> Option<SubscriptionPlan> {
        env.storage().persistent().get(&DataKey::SubscriptionPlan(plan_id))
    }

    /// Check if user has access to a category
    pub fn has_category_access(env: Env, user: Address, category_id: u32) -> bool {
        // Direct access
        if let Some(subscription) = env
            .storage()
            .persistent()
            .get::<DataKey, UserSubscription>(&DataKey::UserSubscription(user.clone()))
        {
            if subscription.status == SubscriptionStatus::Active {
                if let Some(plan) = env
                    .storage()
                    .persistent()
                    .get::<DataKey, SubscriptionPlan>(&DataKey::SubscriptionPlan(subscription.plan_id))
                {
                    if plan.category_ids.contains(&category_id) {
                        return true;
                    }
                }
            }
        }

        // Family access
        if let Some(owner) = env.storage().persistent().get::<_, Address>(&DataKey::MemberToOwner(user.clone())) {
            if let Some(owner_sub) = env.storage().persistent().get::<_, UserSubscription>(&DataKey::UserSubscription(owner)) {
                if owner_sub.status == SubscriptionStatus::Active {
                    if let Some(plan) = env.storage().persistent().get::<_, SubscriptionPlan>(&DataKey::SubscriptionPlan(owner_sub.plan_id)) {
                        return plan.category_ids.contains(&category_id);
                    }
                }
            }
        }

        false
    }

    /// Check if family member has access
    pub fn check_family_access(env: Env, member: Address, category_id: u32) -> bool {
        Self::has_category_access(env, member, category_id)
    }
}
