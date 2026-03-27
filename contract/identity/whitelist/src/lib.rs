#![no_std]
#![deny(clippy::all)]
#![deny(clippy::pedantic)]
#![warn(clippy::nursery)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::cast_possible_truncation)]

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Vec, IntoVal, xdr::ToXdr, Bytes};
use gathera_common::{validate_address, validate_token_address};

mod merkle;
mod storage;
mod error;

#[cfg(test)]
mod test;

use crate::storage::{Campaign, DataKey};
use crate::error::WhitelistError;

#[contract]
pub struct WhitelistContract;

/// The Whitelist Contract manages airdrops and token distributions using Merkle trees for efficiency.
///
/// Each campaign represents a separate distribution event with its own Merkle root, token, and deadline.
/// Users can claim their allocated tokens by providing a valid Merkle proof.
/// Supports claim delegation and automatic refunds for unclaimed tokens.
#[contractimpl]
impl WhitelistContract {
    /// Initializes the whitelist contract.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `admin` - The global administrator address.
    ///
    /// # Errors
    /// Returns [WhitelistError::AlreadyInitialized] if already called.
    pub fn init(env: Env, admin: Address) -> Result<(), WhitelistError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(WhitelistError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CampaignCount, &0u32);
        Ok(())
    }

    /// Creates a new airdrop campaign.
    ///
    /// # Arguments
    /// * `admin` - The address managing this specific campaign.
    /// * `token` - Token address to be distributed.
    /// * `root` - Merkle root of the whitelist.
    /// * `deadline` - Unix timestamp after which claims are disabled.
    /// * `total_amount` - The total tokens deposited for this campaign.
    ///
    /// # Returns
    /// The unique numeric Campaign ID.
    pub fn create_campaign(
        env: Env,
        admin: Address,
        token: Address,
        root: BytesN<32>,
        deadline: u64,
        total_amount: i128,
    ) -> Result<u32, WhitelistError> {
        admin.require_auth();
        validate_address(&env, &admin);
        validate_token_address(&env, &token);
        
        let mut count: u32 = env.storage().instance().get(&DataKey::CampaignCount).unwrap_or(0);
        count = count.checked_add(1).ok_or(WhitelistError::ArithmeticOverflow)?;
        
        let campaign = Campaign {
            admin,
            token: token.clone(),
            root,
            total_amount,
            claimed_amount: 0,
            deadline,
            is_active: true,
            refunded: false,
        };

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&campaign.admin, &env.current_contract_address(), &total_amount);

        env.storage().persistent().set(&DataKey::Campaign(count), &campaign);
        env.storage().instance().set(&DataKey::CampaignCount, &count);
        
        Ok(count)
    }

    /// Updates the Merkle root for a campaign.
    pub fn update_root(env: Env, campaign_id: u32, new_root: BytesN<32>) -> Result<(), WhitelistError> {
        let mut campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).ok_or(WhitelistError::CampaignNotFound)?;
        campaign.admin.require_auth();
        
        campaign.root = new_root;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        Ok(())
    }

    /// Batch updates Merkle roots for multiple campaigns.
    pub fn batch_update_roots(env: Env, campaign_ids: Vec<u32>, new_roots: Vec<BytesN<32>>) -> Result<(), WhitelistError> {
        if campaign_ids.len() != new_roots.len() {
            return Err(WhitelistError::MismatchedLengths);
        }

        for i in 0..campaign_ids.len() {
            let id = campaign_ids.get(i).unwrap();
            let root = new_roots.get(i).unwrap();
            Self::update_root(env.clone(), id, root)?;
        }
        Ok(())
    }

    /// Delegated claim rights to another address.
    pub fn delegate_claim(env: Env, campaign_id: u32, delegator: Address, delegatee: Address) {
        delegator.require_auth();
        env.storage().persistent().set(&DataKey::Delegate(campaign_id, delegator), &delegatee);
    }

    /// Claims tokens from a campaign.
    ///
    /// # Arguments
    /// * `campaign_id` - ID of the campaign to claim from.
    /// * `claimant` - Whitelisted address associated with the allocation.
    /// * `amount` - Amount allocated to the claimant in the Merkle root.
    /// * `proof` - Merkle path proof.
    /// * `recipient` - Optional address to receive tokens (defaults to claimant).
    ///
    /// # Errors
    /// * [WhitelistError::InvalidProof] if verification fails.
    /// * [WhitelistError::AlreadyClaimed] if the address has already claimed.
    pub fn claim(
        env: Env,
        campaign_id: u32,
        claimant: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
        recipient: Option<Address>,
    ) -> Result<(), WhitelistError> {
        claimant.require_auth();
        Self::internal_claim(env, campaign_id, claimant, amount, proof, recipient)
    }

    pub fn claim_as_delegate(
        env: Env,
        campaign_id: u32,
        delegator: Address,
        delegatee: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
        recipient: Option<Address>,
    ) -> Result<(), WhitelistError> {
        delegatee.require_auth();
        
        let stored_delegatee: Address = env.storage().persistent()
            .get(&DataKey::Delegate(campaign_id, delegator.clone()))
            .ok_or(WhitelistError::NoDelegationFound)?;
            
        if stored_delegatee != delegatee {
            return Err(WhitelistError::UnauthorizedDelegate);
        }

        Self::internal_claim(env, campaign_id, delegator, amount, proof, recipient)
    }

    fn internal_claim(
        env: Env,
        campaign_id: u32,
        claimant: Address, // This is the whitelisted address
        amount: i128,
        proof: Vec<BytesN<32>>,
        recipient: Option<Address>,
    ) -> Result<(), WhitelistError> {
        let mut campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).ok_or(WhitelistError::CampaignNotFound)?;
        
        if !campaign.is_active {
            return Err(WhitelistError::CampaignInactive);
        }
        if env.ledger().timestamp() > campaign.deadline {
            return Err(WhitelistError::CampaignExpired);
        }
        if env.storage().persistent().has(&DataKey::Claimed(campaign_id, claimant.clone())) {
            return Err(WhitelistError::AlreadyClaimed);
        }

        // Verify Merkle Proof
        let leaf = Self::hash_leaf(&env, &claimant, amount);
        if !merkle::verify(&env, campaign.root.clone(), leaf, proof) {
            return Err(WhitelistError::InvalidProof);
        }

        // Update state
        campaign.claimed_amount = campaign.claimed_amount.checked_add(amount).ok_or(WhitelistError::ArithmeticOverflow)?;
        if campaign.claimed_amount > campaign.total_amount {
            return Err(WhitelistError::InsufficientFundsInCampaign);
        }

        env.storage().persistent().set(&DataKey::Claimed(campaign_id, claimant.clone()), &true);
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        // Transfer tokens
        let destination = recipient.unwrap_or(claimant.clone());
        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &destination, &amount);
        Ok(())
    }

    pub fn refund(env: Env, campaign_id: u32) -> Result<(), WhitelistError> {
        let mut campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).ok_or(WhitelistError::CampaignNotFound)?;
        campaign.admin.require_auth();

        if env.ledger().timestamp() <= campaign.deadline {
            return Err(WhitelistError::CampaignNotYetFinished);
        }
        if campaign.refunded {
            return Err(WhitelistError::AlreadyRefunded);
        }

        let remaining = campaign.total_amount.checked_sub(campaign.claimed_amount).expect("Arithmetic overflow");
        if remaining > 0 {
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&env.current_contract_address(), &campaign.admin, &remaining);
        }

        campaign.refunded = true;
        campaign.is_active = false;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        Ok(())
    }

    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("campaign not found")
    }

    fn hash_leaf(env: &Env, address: &Address, amount: i128) -> BytesN<32> {
        let mut bytes = address.to_xdr(env);
        bytes.extend(&amount.to_xdr(env));
        env.crypto().sha256(&bytes)
    }
}
