#![no_std]

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, String, Vec, token, log, Symbol};

mod storage;
use storage::*;

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        timelock_duration: u64,
        emergency_address: Address,
    ) -> Result<(), GovernanceError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(GovernanceError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TimelockDuration, &timelock_duration);
        env.storage().instance().set(&DataKey::EmergencyAddress, &emergency_address);
        env.storage().instance().set(&DataKey::ProposalCount, &0u32);

        // Initialize default categories
        Self::set_category_settings(&env, 0, 1000, 50, 100); // ProtocolUpgrade
        Self::set_category_settings(&env, 1, 500, 50, 50);   // FeeAdjustment
        Self::set_category_settings(&env, 2, 100, 50, 30);   // ParameterUpdate
        Self::set_category_settings(&env, 3, 2000, 66, 20);  // Emergency
        Ok(())
    }

    pub fn set_category_settings(env: &Env, category_id: u32, quorum: i128, threshold: u32, period: u32) {
        let settings = CategorySettings {
            quorum,
            threshold,
            voting_period: period,
        };
        env.storage().instance().set(&DataKey::CategorySettings(category_id), &settings);

        // Emit event
        env.events().publish(
            (Symbol::new(env, "category_settings_updated"), category_id),
            (quorum, threshold, period),
        );
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        action: GovernanceAction,
        category: ProposalCategory,
        description: String,
    ) -> Result<u32, GovernanceError> {
        proposer.require_auth();

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).ok_or(GovernanceError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);
        let balance = token_client.balance(&proposer);
        
        let min_propose_power = 100; // Hardcoded for now
        if balance < min_propose_power {
            return Err(GovernanceError::InsufficientTokens);
        }

        let category_id = match category {
            ProposalCategory::ProtocolUpgrade => 0,
            ProposalCategory::FeeAdjustment => 1,
            ProposalCategory::ParameterUpdate => 2,
            ProposalCategory::Emergency => 3,
        };

        let settings: CategorySettings = env.storage().instance().get(&DataKey::CategorySettings(category_id))
            .ok_or(GovernanceError::CategoryNotFound)?;

        let mut count: u32 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0);
        count = count.checked_add(1).expect("Proposal count overflow");

        let proposal = Proposal {
            id: count,
            proposer: proposer.clone(),
            action,
            category,
            description,
            start_ledger: env.ledger().sequence(),
            end_ledger: env.ledger().sequence().checked_add(settings.voting_period).expect("Ledger overflow"),
            total_votes_for: 0,
            total_votes_against: 0,
            status: ProposalStatus::Active,
            eta: 0,
        };

        env.storage().persistent().set(&DataKey::Proposal(count), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &count);

        Ok(count)
    }

    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u32,
        support: bool,
        use_quadratic: bool,
        delegators: Vec<Address>,
    ) -> Result<(), GovernanceError> {
        voter.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(GovernanceError::ProposalNotFound)?;

        if env.ledger().sequence() > proposal.end_ledger {
            return Err(GovernanceError::VotingPeriodEnded);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).ok_or(GovernanceError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);

        let mut total_power: i128 = 0;

        // Voter's own power
        if !env.storage().persistent().has(&DataKey::Vote(proposal_id, voter.clone())) {
            let balance = token_client.balance(&voter);
            let power = if use_quadratic { Self::sqrt(balance) } else { balance };
            total_power = total_power.checked_add(power).expect("Power overflow");
            
            env.storage().persistent().set(&DataKey::Vote(proposal_id, voter.clone()), &VoteRecord {
                voter: voter.clone(),
                support,
                amount: power,
                is_quadratic: use_quadratic,
            });
        }

        // Delegators' power
        for delegator in delegators.iter() {
            let delegatee: Address = env.storage().persistent().get(&DataKey::UserDelegation(delegator.clone()))
                .ok_or(GovernanceError::InvalidDelegation)?;
            
            if delegatee != voter {
                return Err(GovernanceError::Unauthorized);
            }

            if env.storage().persistent().has(&DataKey::Vote(proposal_id, delegator.clone())) {
                continue;
            }

            let balance = token_client.balance(&delegator);
            let power = if use_quadratic { Self::sqrt(balance) } else { balance };
            
            total_power = total_power.checked_add(power).expect("Power overflow");

            env.storage().persistent().set(&DataKey::Vote(proposal_id, delegator.clone()), &VoteRecord {
                voter: voter.clone(),
                support,
                amount: power,
                is_quadratic: use_quadratic,
            });
        }

        if support {
            proposal.total_votes_for = proposal.total_votes_for.checked_add(total_power).expect("Votes overflow");
        } else {
            proposal.total_votes_against = proposal.total_votes_against.checked_add(total_power).expect("Votes overflow");
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        Ok(())
    }

    pub fn delegate(env: Env, delegator: Address, delegatee: Address) {
        delegator.require_auth();
        env.storage().persistent().set(&DataKey::UserDelegation(delegator.clone()), &delegatee.clone());

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "delegation_updated"), delegator),
            delegatee,
        );
    }

    pub fn revoke_delegation(env: Env, delegator: Address) {
        delegator.require_auth();
        env.storage().persistent().remove(&DataKey::UserDelegation(delegator.clone()));

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "delegation_revoked"),),
            delegator,
        );
    }

    pub fn queue(env: Env, proposal_id: u32) -> Result<(), GovernanceError> {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(GovernanceError::ProposalNotFound)?;

        if env.ledger().sequence() <= proposal.end_ledger {
            return Err(GovernanceError::VotingPeriodNotEnded);
        }

        let category_id = match proposal.category {
            ProposalCategory::ProtocolUpgrade => 0,
            ProposalCategory::FeeAdjustment => 1,
            ProposalCategory::ParameterUpdate => 2,
            ProposalCategory::Emergency => 3,
        };

        let settings: CategorySettings = env.storage().instance().get(&DataKey::CategorySettings(category_id))
            .ok_or(GovernanceError::CategoryNotFound)?;

        let total_votes = proposal.total_votes_for.checked_add(proposal.total_votes_against).expect("Votes overflow");
        if total_votes >= settings.quorum {
            let for_percentage = if total_votes > 0 { 
                (proposal.total_votes_for.checked_mul(100).expect("Arithmetic error")).checked_div(total_votes).expect("Arithmetic error")
            } else { 0 };
            if for_percentage >= settings.threshold as i128 {
                proposal.status = ProposalStatus::Queued;
                let timelock: u64 = env.storage().instance().get(&DataKey::TimelockDuration).unwrap_or(0);
                proposal.eta = env.ledger().timestamp() + timelock;
            } else {
                proposal.status = ProposalStatus::Defeated;
            }
        } else {
            proposal.status = ProposalStatus::Defeated;
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        Ok(())
    }

    pub fn execute(env: Env, proposal_id: u32) -> Result<(), GovernanceError> {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(GovernanceError::ProposalNotFound)?;

        if !matches!(proposal.status, ProposalStatus::Queued) {
            return Err(GovernanceError::ProposalNotQueued);
        }

        if env.ledger().timestamp() < proposal.eta {
            return Err(GovernanceError::TimelockNotExpired);
        }

        proposal.status = ProposalStatus::Executed;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        
        env.events().publish((symbol_short!("execute"), proposal_id), proposal.action);
        Ok(())
    }

    pub fn emergency_action(env: Env, caller: Address, action: GovernanceAction) -> Result<(), GovernanceError> {
        let emergency_addr: Address = env.storage().instance().get(&DataKey::EmergencyAddress).ok_or(GovernanceError::NotInitialized)?;
        caller.require_auth();
        
        if caller != emergency_addr {
            return Err(GovernanceError::Unauthorized);
        }

        env.events().publish((symbol_short!("emergen"),), action);
        Ok(())
    }

    fn sqrt(n: i128) -> i128 {
        if n <= 0 { return 0; }
        let mut x = n;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }

    pub fn get_proposal(env: Env, proposal_id: u32) -> Result<Proposal, GovernanceError> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id)).ok_or(GovernanceError::ProposalNotFound)
    }

    pub fn get_vote(env: Env, proposal_id: u32, voter: Address) -> Option<VoteRecord> {
        env.storage().persistent().get(&DataKey::Vote(proposal_id, voter))
    }

    pub fn get_delegation(env: Env, delegator: Address) -> Option<Address> {
        env.storage().persistent().get(&DataKey::UserDelegation(delegator))
    }
}

#[cfg(test)]
mod test;
