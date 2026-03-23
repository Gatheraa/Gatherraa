#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, Escrow, EscrowStatus, RevenueSplit, Milestone, Dispute, 
                   DisputeResolution, ReferralTracker, RevenueSplitConfig, EscrowError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    // Initialize the contract
    pub fn initialize(e: Env, admin: Address, config: RevenueSplitConfig) -> Result<(), EscrowError> {
        if e.storage().instance().has(&DataKey::Admin) {
            return Err(EscrowError::AlreadyInitialized);
        }

        // Validate configuration
        Self::validate_config(&config)?;

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::RevenueSplitConfig, &config);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        Ok(())
    }

    // Create a new escrow
    pub fn create_escrow(
        e: Env,
        event: Address,
        organizer: Address,
        purchaser: Address,
        amount: i128,
        token: Address,
        release_time: u64,
        revenue_splits: Option<RevenueSplit>,
        referral: Option<Address>,
        milestones: Option<Vec<Milestone>>,
    ) -> Result<BytesN<32>, EscrowError> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            return Err(EscrowError::ContractPaused);
        }

        // Validate amount against config
        let config: RevenueSplitConfig = e.storage().instance().get(&DataKey::RevenueSplitConfig)
            .ok_or(EscrowError::NotInitialized)?;
            
        if amount < config.min_escrow_amount {
            return Err(EscrowError::AmountTooLow);
        }
        if amount > config.max_escrow_amount {
            return Err(EscrowError::AmountTooHigh);
        }

        // Generate unique escrow ID
        let escrow_id = Self::generate_escrow_id(&e, &event, &purchaser, amount);

        // Use provided revenue splits or defaults
        let splits = revenue_splits.unwrap_or(RevenueSplit {
            organizer_percentage: config.default_organizer_percentage,
            platform_percentage: config.default_platform_percentage,
            referral_percentage: config.default_referral_percentage,
            precision: config.precision,
        });

        // Validate revenue splits
        Self::validate_revenue_splits(&splits)?;

        // Handle referral if provided
        if let Some(ref ref_addr) = referral {
            Self::track_referral(&e, ref_addr, &purchaser);
        }

        let escrow = Escrow {
            id: escrow_id.clone(),
            event: event.clone(),
            organizer: organizer.clone(),
            purchaser: purchaser.clone(),
            amount,
            token: token.clone(),
            created_at: e.ledger().timestamp(),
            release_time,
            status: EscrowStatus::Pending,
            revenue_splits: splits,
            referral,
            milestones: milestones.unwrap_or_else(|| Vec::new(&e)),
            dispute_active: false,
        };

        // Store escrow
        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);

        // Update event escrows
        let event_key = DataKey::EventEscrows(event);
        let mut event_escrows: Vec<BytesN<32>> = e.storage().persistent().get(&event_key).unwrap_or_else(|| Vec::new(&e));
        event_escrows.push_back(escrow_id.clone());
        e.storage().persistent().set(&event_key, &event_escrows);

        // Update user escrows
        let user_key = DataKey::UserEscrows(purchaser);
        let mut user_escrows: Vec<BytesN<32>> = e.storage().persistent().get(&user_key).unwrap_or_else(|| Vec::new(&e));
        user_escrows.push_back(escrow_id.clone());
        e.storage().persistent().set(&user_key, &user_escrows);

        // Emit event
        e.events().publish(
            (symbol_short!("esc_creat"), escrow_id.clone()),
            (event, organizer, purchaser, amount, token),
        );

        Ok(escrow_id)
    }

    // Lock escrow (transfer funds to contract)
    pub fn lock_escrow(e: Env, escrow_id: BytesN<32>) -> Result<(), EscrowError> {
        let mut escrow: Escrow = e.storage().instance().get(&DataKey::Escrow(escrow_id.clone()))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Pending {
            return Err(EscrowError::InvalidStatus);
        }

        escrow.purchaser.require_auth();

        // Transfer tokens to contract
        let token_client = soroban_sdk::token::Client::new(&e, &escrow.token);
        token_client.transfer(&escrow.purchaser, &e.current_contract_address(), &escrow.amount);

        escrow.status = EscrowStatus::Locked;
        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);

        e.events().publish(
            (symbol_short!("esc_lock"), escrow_id.clone()),
            escrow.amount,
        );
        Ok(())
    }

    // Release escrow funds
    pub fn release_escrow(e: Env, escrow_id: BytesN<32>) -> Result<(), EscrowError> {
        let mut escrow: Escrow = e.storage().instance().get(&DataKey::Escrow(escrow_id.clone()))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Locked {
            return Err(EscrowError::InvalidStatus);
        }

        if escrow.dispute_active {
            return Err(EscrowError::DisputeActive);
        }

        if e.ledger().timestamp() < escrow.release_time {
            return Err(EscrowError::InvalidTime);
        }

        // Authorize organizer
        escrow.organizer.require_auth();

        // Calculate and distribute revenue splits
        Self::distribute_revenue(&e, &escrow)?;

        escrow.status = EscrowStatus::Released;
        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);

        e.events().publish(
            (symbol_short!("esc_rel"), escrow_id.clone()),
            escrow.amount,
        );
        Ok(())
    }

    // Refund escrow
    pub fn refund_escrow(e: Env, escrow_id: BytesN<32>) -> Result<(), EscrowError> {
        let mut escrow: Escrow = e.storage().instance().get(&DataKey::Escrow(escrow_id.clone()))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Locked {
            return Err(EscrowError::InvalidStatus);
        }

        if escrow.dispute_active {
            return Err(EscrowError::DisputeActive);
        }

        // Authorize organizer
        escrow.organizer.require_auth();

        // Refund full amount to purchaser
        let token_client = soroban_sdk::token::Client::new(&e, &escrow.token);
        token_client.transfer(&e.current_contract_address(), &escrow.purchaser, &escrow.amount);

        escrow.status = EscrowStatus::Refunded;
        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);

        e.events().publish(
            (symbol_short!("esc_ref"), escrow_id.clone()),
            escrow.amount,
        );
        Ok(())
    }

    // Create dispute
    pub fn create_dispute(e: Env, escrow_id: BytesN<32>, challenger: Address, reason: Symbol, evidence: Vec<Symbol>) -> Result<(), EscrowError> {
        let mut escrow: Escrow = e.storage().instance().get(&DataKey::Escrow(escrow_id.clone()))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Locked {
            return Err(EscrowError::InvalidStatus);
        }

        if escrow.dispute_active {
            return Err(EscrowError::DisputeActive);
        }

        challenger.require_auth();

        let dispute = Dispute {
            escrow_id: escrow_id.clone(),
            challenger: challenger.clone(),
            reason,
            evidence,
            created_at: e.ledger().timestamp(),
            resolved: false,
            resolution: None,
        };

        escrow.dispute_active = true;
        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);
        e.storage().instance().set(&DataKey::Dispute(escrow_id.clone()), &dispute);

        e.events().publish(
            (symbol_short!("disp_cre"), escrow_id.clone()),
            challenger,
        );
        Ok(())
    }

    // Resolve dispute
    pub fn resolve_dispute(e: Env, escrow_id: BytesN<32>, resolution: DisputeResolution) -> Result<(), EscrowError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;
        admin.require_auth();

        let mut escrow: Escrow = e.storage().instance().get(&DataKey::Escrow(escrow_id.clone()))
            .ok_or(EscrowError::EscrowNotFound)?;

        if !escrow.dispute_active {
            return Err(EscrowError::NoDispute);
        }

        let mut dispute: Dispute = e.storage().instance().get(&DataKey::Dispute(escrow_id.clone()))
            .ok_or(EscrowError::NoDispute)?;

        // Execute resolution
        let token_client = soroban_sdk::token::Client::new(&e, &escrow.token);
        let contract_address = e.current_contract_address();

        // Refund amount to winner
        if resolution.refund_amount > 0 {
            token_client.transfer(&contract_address, &resolution.winner, &resolution.refund_amount);
        }

        // Penalty amount to platform (admin)
        if resolution.penalty_amount > 0 {
            token_client.transfer(&contract_address, &admin, &resolution.penalty_amount);
        }

        dispute.resolved = true;
        dispute.resolution = Some(resolution.clone());
        escrow.dispute_active = false;
        escrow.status = EscrowStatus::Disputed;

        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);
        e.storage().instance().set(&DataKey::Dispute(escrow_id.clone()), &dispute);

        e.events().publish(
            (symbol_short!("disp_res"), escrow_id.clone()),
            resolution.winner,
        );
        Ok(())
    }

    // Release milestone payment
    pub fn release_milestone(e: Env, escrow_id: BytesN<32>, milestone_id: u32) -> Result<(), EscrowError> {
        let mut escrow: Escrow = e.storage().instance().get(&DataKey::Escrow(escrow_id.clone()))
            .ok_or(EscrowError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Locked {
            return Err(EscrowError::InvalidStatus);
        }

        if escrow.dispute_active {
            return Err(EscrowError::DisputeActive);
        }

        // Find milestone
        let milestone_index = escrow.milestones.iter().position(|m| m.id == milestone_id)
            .ok_or(EscrowError::InvalidMilestone)?;

        if escrow.milestones[milestone_index].released {
            return Err(EscrowError::MilestoneAlreadyReleased);
        }

        if e.ledger().timestamp() < escrow.milestones[milestone_index].release_time {
            return Err(EscrowError::InvalidTime);
        }

        escrow.organizer.require_auth();

        // Release milestone amount with revenue splits
        let token_client = soroban_sdk::token::Client::new(&e, &escrow.token);
        let contract_address = e.current_contract_address();
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(EscrowError::NotInitialized)?;

        let milestone_amt = escrow.milestones[milestone_index].amount;

        // Calculate splits for milestone amount
        let organizer_amount = Self::calculate_split(milestone_amt, escrow.revenue_splits.organizer_percentage, escrow.revenue_splits.precision);
        let platform_amount = Self::calculate_split(milestone_amt, escrow.revenue_splits.platform_percentage, escrow.revenue_splits.precision);
        let mut referral_amount = Self::calculate_split(milestone_amt, escrow.revenue_splits.referral_percentage, escrow.revenue_splits.precision);

        // Adjust for rounding
        let total_splits = organizer_amount + platform_amount + referral_amount;
        if total_splits > milestone_amt {
            referral_amount -= (total_splits - milestone_amt);
        }

        // Transfer funds
        token_client.transfer(&contract_address, &escrow.organizer, &organizer_amount);
        token_client.transfer(&contract_address, &admin, &platform_amount);

        if let Some(ref ref_addr) = escrow.referral {
            if referral_amount > 0 {
                token_client.transfer(&contract_address, ref_addr, &referral_amount);
                Self::update_referral_rewards(&e, ref_addr, referral_amount);
            }
        }

        // Update milestone
        escrow.milestones[milestone_index].released = true;
        e.storage().instance().set(&DataKey::Escrow(escrow_id.clone()), &escrow);

        e.events().publish(
            (symbol_short!("mil_rel"), escrow_id.clone()),
            milestone_id,
        );
        Ok(())
    }

    // Emergency withdrawal (admin only)
    pub fn emergency_withdraw(e: Env, token: Address, amount: i128) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let config: RevenueSplitConfig = e.storage().instance().get(&DataKey::RevenueSplitConfig).unwrap();
        
        // Check delay
        let last_emergency_withdrawal: Option<u64> = e.storage().instance().get(&symbol_short!("last_emergency"));
        if let Some(last_time) = last_emergency_withdrawal {
            if e.ledger().timestamp() < last_time + config.emergency_withdrawal_delay {
                panic!("emergency withdrawal delay not met");
            }
        }

        let token_client = soroban_sdk::token::Client::new(&e, &token);
        let contract_address = e.current_contract_address();
        
        token_client.transfer(&contract_address, &admin, &amount);

        e.storage().instance().set(&symbol_short!("last_emergency"), &e.ledger().timestamp());

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("emergency_withdraw"),),
            (token, amount),
        );
    }

    // Admin functions
    pub fn pause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn update_config(e: Env, new_config: RevenueSplitConfig) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        Self::validate_config(&new_config);
        e.storage().instance().set(&DataKey::RevenueSplitConfig, &new_config);
    }

    // View functions
    pub fn get_escrow(e: Env, escrow_id: BytesN<32>) -> Escrow {
        e.storage().instance().get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("escrow not found"))
    }

    pub fn get_event_escrows(e: Env, event: Address) -> Vec<BytesN<32>> {
        e.storage().persistent().get(&DataKey::EventEscrows(event))
            .unwrap_or(Vec::new(&e))
    }

    pub fn get_user_escrows(e: Env, user: Address) -> Vec<BytesN<32>> {
        e.storage().persistent().get(&DataKey::UserEscrows(user))
            .unwrap_or(Vec::new(&e))
    }

    pub fn get_dispute(e: Env, escrow_id: BytesN<32>) -> Dispute {
        e.storage().instance().get(&DataKey::Dispute(escrow_id))
            .unwrap_or_else(|| panic!("dispute not found"))
    }

    pub fn get_referral_info(e: Env, referrer: Address) -> ReferralTracker {
        e.storage().persistent().get(&DataKey::ReferralTracker(referrer))
            .unwrap_or(ReferralTracker {
                referrer: referrer.clone(),
                total_rewards: 0,
                referral_count: 0,
                last_referral: 0,
            })
    }

    pub fn get_config(e: Env) -> RevenueSplitConfig {
        e.storage().instance().get(&DataKey::RevenueSplitConfig).unwrap()
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn generate_escrow_id(e: &Env, event: &Address, purchaser: &Address, amount: i128) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(event.to_val());
        data.push_back(purchaser.to_val());
        data.push_back(amount.to_val());
        data.push_back(e.ledger().timestamp().to_val());
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn validate_config(config: &RevenueSplitConfig) -> Result<(), EscrowError> {
        let total_percentage = config.default_organizer_percentage + config.default_platform_percentage + config.default_referral_percentage;
        if total_percentage != 100 * config.precision {
            return Err(EscrowError::InvalidPercentage);
        }

        if config.max_referral_percentage > 50 * config.precision {
            return Err(EscrowError::InvalidPercentage);
        }

        if config.min_escrow_amount <= 0 || config.max_escrow_amount <= config.min_escrow_amount {
            return Err(EscrowError::InvalidAmount);
        }
        Ok(())
    }

    fn validate_revenue_splits(splits: &RevenueSplit) -> Result<(), EscrowError> {
        let total_percentage = splits.organizer_percentage + splits.platform_percentage + splits.referral_percentage;
        if total_percentage != 100 * splits.precision {
            return Err(EscrowError::InvalidPercentage);
        }
        Ok(())
    }

    fn calculate_split(amount: i128, percentage: u32, precision: u32) -> i128 {
        (amount * percentage as i128) / (100 * precision as i128)
    }

    fn distribute_revenue(e: &Env, escrow: &Escrow) -> Result<(), EscrowError> {
        let token_client = soroban_sdk::token::Client::new(e, &escrow.token);
        let contract_address = e.current_contract_address();
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(EscrowError::NotInitialized)?;

        let organizer_amount = Self::calculate_split(escrow.amount, escrow.revenue_splits.organizer_percentage, escrow.revenue_splits.precision);
        let platform_amount = Self::calculate_split(escrow.amount, escrow.revenue_splits.platform_percentage, escrow.revenue_splits.precision);
        let mut referral_amount = Self::calculate_split(escrow.amount, escrow.revenue_splits.referral_percentage, escrow.revenue_splits.precision);

        // Adjust for rounding
        let total_splits = organizer_amount + platform_amount + referral_amount;
        if total_splits > escrow.amount {
            referral_amount -= (total_splits - escrow.amount);
        }

        // Transfer funds
        token_client.transfer(&contract_address, &escrow.organizer, &organizer_amount);
        token_client.transfer(&contract_address, &admin, &platform_amount);

        if let Some(ref ref_addr) = escrow.referral {
            if referral_amount > 0 {
                token_client.transfer(&contract_address, ref_addr, &referral_amount);
                Self::update_referral_rewards(e, ref_addr, referral_amount);
            }
        }
        Ok(())
    }

    fn track_referral(e: &Env, referrer: &Address, purchaser: &Address) {
        // Prevent self-referral
        if referrer == purchaser {
            return;
        }

        let key = DataKey::ReferralTracker(referrer.clone());
        let mut tracker: ReferralTracker = e.storage().persistent().get(&key)
            .unwrap_or(ReferralTracker {
                referrer: referrer.clone(),
                total_rewards: 0,
                referral_count: 0,
                last_referral: 0,
            });

        tracker.referral_count += 1;
        tracker.last_referral = e.ledger().timestamp();

        e.storage().persistent().set(&key, &tracker);
    }

    fn update_referral_rewards(e: &Env, referrer: &Address, reward_amount: i128) {
        let key = DataKey::ReferralTracker(referrer.clone());
        let mut tracker: ReferralTracker = e.storage().persistent().get(&key)
            .unwrap_or(ReferralTracker {
                referrer: referrer.clone(),
                total_rewards: 0,
                referral_count: 0,
                last_referral: 0,
            });

        tracker.total_rewards += reward_amount;

        e.storage().persistent().set(&key, &tracker);
    }
}
