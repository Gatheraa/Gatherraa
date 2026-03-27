#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{token, Address, Env, Vec, String, Symbol, Map};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &contract_id.address())
}

fn setup_governance_contract(env: &Env) -> (Address, token::Client<'_>, Address, Address, Address) {
    let admin = Address::generate(env);
    let emergency = Address::generate(env);
    let proposer = Address::generate(env);
    let token = create_token_contract(env, &admin);
    
    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(env, &contract_id);
    
    client.init(&admin, &token.address, &100, &emergency);
    
    (admin, token, emergency, proposer, contract_id.address())
}

#[test]
fn test_governance_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &200);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    assert_eq!(prop_id, 1);

    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &false, &false, &Vec::new(&env));

    // Advance time past voting period
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    client.execute(&prop_id);
    
    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Executed);
}

#[test]
fn test_double_initialization_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    
    let contract_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token.address, &100, &emergency);
    
    let result = std::panic::catch_unwind(|| {
        client.init(&admin, &token.address, &100, &emergency);
    });
    assert!(result.is_err());
}

#[test]
fn test_create_proposal_insufficient_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    
    let client = GovernanceContractClient::new(&env, &contract_address);
    
    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    
    let result = std::panic::catch_unwind(|| {
        client.create_proposal(
            &proposer,
            &action,
            &ProposalCategory::ParameterUpdate,
            &String::from_str(&env, "Increase fee to 50 bps")
        );
    });
    assert!(result.is_err());
}

#[test]
fn test_proposal_categories() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    
    let client = GovernanceContractClient::new(&env, &contract_address);

    // Test Protocol Upgrade category
    let upgrade_action = GovernanceAction::ProtocolUpgrade(BytesN::from_array(&env, &[1; 32]));
    let upgrade_prop_id = client.create_proposal(
        &proposer,
        &upgrade_action,
        &ProposalCategory::ProtocolUpgrade,
        &String::from_str(&env, "Protocol upgrade proposal")
    );

    let upgrade_proposal = client.get_proposal(&upgrade_prop_id);
    assert_eq!(upgrade_proposal.category, ProposalCategory::ProtocolUpgrade);

    // Test Fee Adjustment category
    let fee_action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let fee_prop_id = client.create_proposal(
        &proposer,
        &fee_action,
        &ProposalCategory::FeeAdjustment,
        &String::from_str(&env, "Fee adjustment proposal")
    );

    let fee_proposal = client.get_proposal(&fee_prop_id);
    assert_eq!(fee_proposal.category, ProposalCategory::FeeAdjustment);

    // Test Emergency category
    let emergency_action = GovernanceAction::EmergencyAction(String::from_str(&env, "pause_contracts"));
    let emergency_prop_id = client.create_proposal(
        &proposer,
        &emergency_action,
        &ProposalCategory::Emergency,
        &String::from_str(&env, "Emergency pause proposal")
    );

    let emergency_proposal = client.get_proposal(&emergency_prop_id);
    assert_eq!(emergency_proposal.category, ProposalCategory::Emergency);
}

#[test]
fn test_voting_mechanics() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &500);
    token_admin.mint(&voter3, &300);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    // Test voting
    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter3, &prop_id, &false, &false, &Vec::new(&env));

    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.total_votes_for, 1500); // 1000 + 500
    assert_eq!(proposal.total_votes_against, 300);

    // Test vote changes
    client.vote(&voter2, &prop_id, &false, &false, &Vec::new(&env));
    
    let updated_proposal = client.get_proposal(&prop_id);
    assert_eq!(updated_proposal.total_votes_for, 1000); // Only voter1
    assert_eq!(updated_proposal.total_votes_against, 800); // voter2 + voter3
}

#[test]
fn test_voting_period_enforcement() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &1000);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    // Try to vote after voting period
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101, // Past voting period
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    let result = std::panic::catch_unwind(|| {
        client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    });
    assert!(result.is_err());
}

#[test]
fn test_quorum_and_threshold() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &50); // Below quorum
    token_admin.mint(&voter2, &50); // Below quorum

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    // Vote but don't meet quorum
    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &true, &false, &Vec::new(&env));

    // Advance time past voting period
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    // Should fail due to insufficient quorum
    let result = std::panic::catch_unwind(|| {
        client.execute(&prop_id);
    });
    assert!(result.is_err());

    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Rejected);
}

#[test]
fn test_emergency_proposal() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &1000);
    token_admin.mint(&voter3, &500);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::EmergencyAction(String::from_str(&env, "pause_contracts"));
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::Emergency,
        &String::from_str(&env, "Emergency pause proposal")
    );

    // Vote for emergency proposal (requires higher threshold)
    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &true, &false, &Vec::new(&env));

    // Should fail - not enough votes for emergency threshold (66%)
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 51, // Emergency period is shorter
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    let result = std::panic::catch_unwind(|| {
        client.execute(&prop_id);
    });
    assert!(result.is_err());

    // Add third vote to meet threshold
    client.vote(&voter3, &prop_id, &true, &false, &Vec::new(&env));

    // Should succeed now
    client.execute(&prop_id);
    
    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Executed);
}

#[test]
fn test_timelock_execution() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &1000);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ProtocolUpgrade(BytesN::from_array(&env, &[1; 32]));
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ProtocolUpgrade,
        &String::from_str(&env, "Protocol upgrade proposal")
    );

    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &true, &false, &Vec::new(&env));

    // Advance time past voting period
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    client.execute(&prop_id);
    
    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Timelocked);
    assert!(proposal.eta > 0);

    // Try to execute before timelock expires
    let result = std::panic::catch_unwind(|| {
        client.execute(&prop_id);
    });
    assert!(result.is_err());

    // Advance time past timelock
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 101, // Add timelock duration
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 1,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    // Should succeed now
    client.execute(&prop_id);
    
    let final_proposal = client.get_proposal(&prop_id);
    assert_eq!(final_proposal.status, ProposalStatus::Executed);
}

#[test]
fn test_cancel_proposal() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    // Cancel proposal
    client.cancel(&proposer, &prop_id);
    
    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Canceled);
}

#[test]
fn test_cancel_proposal_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let unauthorized = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    // Try to cancel with unauthorized address
    let result = std::panic::catch_unwind(|| {
        client.cancel(&unauthorized, &prop_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_category_settings_update() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    
    let client = GovernanceContractClient::new(&env, &contract_address);

    // Update category settings
    client.set_category_settings(&admin, &1, &2000, &60, &60); // Fee adjustment
    
    let settings = client.get_category_settings(&1);
    assert_eq!(settings.quorum, 2000);
    assert_eq!(settings.threshold, 60);
    assert_eq!(settings.voting_period, 60);
}

#[test]
fn test_edge_case_zero_votes() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    // No votes cast
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    // Should be rejected due to no votes
    let result = std::panic::catch_unwind(|| {
        client.execute(&prop_id);
    });
    assert!(result.is_err());

    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Rejected);
}

#[test]
fn test_multiple_active_proposals() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &1000);
    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &1000);

    let client = GovernanceContractClient::new(&env, &contract_address);

    // Create multiple proposals
    let action1 = GovernanceAction::ParameterChange(String::from_str(&env, "fee1"), 50);
    let prop_id1 = client.create_proposal(
        &proposer,
        &action1,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Proposal 1")
    );

    let action2 = GovernanceAction::ParameterChange(String::from_str(&env, "fee2"), 75);
    let prop_id2 = client.create_proposal(
        &proposer,
        &action2,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Proposal 2")
    );

    // Vote on both proposals
    client.vote(&voter1, &prop_id1, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id1, &true, &false, &Vec::new(&env));
    
    client.vote(&voter1, &prop_id2, &false, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id2, &false, &false, &Vec::new(&env));

    // Advance time past voting period
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 101,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    // Execute both
    client.execute(&prop_id1);
    client.execute(&prop_id2);

    let proposal1 = client.get_proposal(&prop_id1);
    let proposal2 = client.get_proposal(&prop_id2);
    
    assert_eq!(proposal1.status, ProposalStatus::Executed);
    assert_eq!(proposal2.status, ProposalStatus::Rejected);
}

#[test]
fn test_emergency_execute() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);
    token_admin.mint(&voter1, &1000);
    token_admin.mint(&voter2, &1000);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::EmergencyAction(String::from_str(&env, "emergency_pause"));
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::Emergency,
        &String::from_str(&env, "Emergency pause")
    );

    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &true, &false, &Vec::new(&env));

    // Advance time past voting period
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp(),
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 51,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 1000,
    });

    client.execute(&prop_id);
    
    let proposal = client.get_proposal(&prop_id);
    assert_eq!(proposal.status, ProposalStatus::Executed);

    // Emergency execute should bypass timelock
    client.emergency_execute(&emergency, &prop_id);
}

#[test]
fn test_emergency_execute_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, token, emergency, proposer, contract_address) = setup_governance_contract(&env);
    let unauthorized = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&proposer, &500);

    let client = GovernanceContractClient::new(&env, &contract_address);

    let action = GovernanceAction::EmergencyAction(String::from_str(&env, "emergency_pause"));
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::Emergency,
        &String::from_str(&env, "Emergency pause")
    );

    let result = std::panic::catch_unwind(|| {
        client.emergency_execute(&unauthorized, &prop_id);
    });
    assert!(result.is_err());
}
