use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{ZKTicketContract, ZKAttribute, AttributeType, CircuitParameters, BatchStatus};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params.clone());
    
    let stored_params = ZKTicketContract::get_circuit_params(env.clone());
    assert_eq!(stored_params.circuit_hash, circuit_params.circuit_hash);
    assert_eq!(stored_params.attribute_count, circuit_params.attribute_count);
}

#[test]
fn test_create_ticket_commitment() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
    ];
    
    let commitment = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier.clone(),
    );
    
    let stored_commitment = ZKTicketContract::get_commitment(env.clone(), commitment);
    assert_eq!(stored_commitment.event_id, event_id);
    assert_eq!(stored_commitment.ticket_hash, ticket_hash);
    assert_eq!(stored_commitment.nullifier, nullifier);
    assert!(stored_commitment.active);
}

#[test]
fn test_submit_proof() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let owner = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let proof_id = BytesN::from_array(&env, &[5; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
    ];
    
    let commitment = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier.clone(),
    );
    
    let proof_data = vec![&env, 1; 200]; // Simulated proof data
    
    let result = ZKTicketContract::submit_proof(
        env.clone(),
        proof_id.clone(),
        commitment.clone(),
        nullifier.clone(),
        event_id.clone(),
        owner.clone(),
        attributes.clone(),
        proof_data.clone(),
        env.ledger().timestamp() + 86400, // 24 hours from now
    );
    
    assert!(result);
    
    let proof = ZKTicketContract::get_proof(env.clone(), proof_id);
    assert_eq!(proof.proof_id, proof_id);
    assert_eq!(proof.ticket_commitment, commitment);
    assert_eq!(proof.nullifier, nullifier);
    assert_eq!(proof.event_id, event_id);
    assert_eq!(proof.owner, owner);
    assert!(proof.verified_at.is_some());
    
    // Check nullifier is marked as used
    let nullifier_info = ZKTicketContract::get_nullifier_info(env.clone(), nullifier);
    assert!(nullifier_info.used);
    assert_eq!(nullifier_info.proof_id, Some(proof_id));
}

#[test]
fn test_batch_verification() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let owner = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier1 = BytesN::from_array(&env, &[2; 32]);
    let nullifier2 = BytesN::from_array(&env, &[3; 32]);
    let proof_id1 = BytesN::from_array(&env, &[5; 32]);
    let proof_id2 = BytesN::from_array(&env, &[6; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
    ];
    
    // Create two commitments and proofs
    let commitment1 = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier1.clone(),
    );
    
    let commitment2 = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier2.clone(),
    );
    
    let proof_data = vec![&env, 1; 200];
    
    ZKTicketContract::submit_proof(
        env.clone(),
        proof_id1.clone(),
        commitment1.clone(),
        nullifier1.clone(),
        event_id.clone(),
        owner.clone(),
        attributes.clone(),
        proof_data.clone(),
        env.ledger().timestamp() + 86400,
    );
    
    ZKTicketContract::submit_proof(
        env.clone(),
        proof_id2.clone(),
        commitment2.clone(),
        nullifier2.clone(),
        event_id.clone(),
        owner.clone(),
        attributes.clone(),
        proof_data.clone(),
        env.ledger().timestamp() + 86400,
    );
    
    // Batch verify
    let proof_ids = vec![&env, proof_id1.clone(), proof_id2.clone()];
    let batch_id = ZKTicketContract::batch_verify(env.clone(), proof_ids.clone());
    
    let batch = ZKTicketContract::get_batch_verification(env.clone(), batch_id);
    assert_eq!(batch.proofs, proof_ids);
    assert_eq!(batch.status, BatchStatus::Completed);
    assert_eq!(batch.results.len(), 2);
    assert!(batch.results.get_unchecked(0)); // First proof verified
    assert!(batch.results.get_unchecked(1)); // Second proof verified
}

#[test]
fn test_mobile_proof_verification() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let mobile_device_id = BytesN::from_array(&env, &[7; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let proof_template = vec![&env, 1; 100];
    let proof_data = vec![&env, 1; 150];
    
    let result = ZKTicketContract::verify_mobile_proof(
        env.clone(),
        mobile_device_id.clone(),
        proof_template.clone(),
        proof_data.clone(),
        env.ledger().timestamp() + 86400,
    );
    
    assert!(result);
}

#[test]
fn test_selective_disclosure() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let owner = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let proof_id = BytesN::from_array(&env, &[5; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::SeatNumber,
            value: vec![&env, 9, 10, 11, 12],
            revealed: false,
            commitment: BytesN::from_array(&env, &[5; 32]),
        },
    ];
    
    let commitment = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier.clone(),
    );
    
    let proof_data = vec![&env, 1; 200];
    
    ZKTicketContract::submit_proof(
        env.clone(),
        proof_id.clone(),
        commitment.clone(),
        nullifier.clone(),
        event_id.clone(),
        owner.clone(),
        attributes.clone(),
        proof_data.clone(),
        env.ledger().timestamp() + 86400,
    );
    
    // Reveal specific attributes
    let attribute_types = vec![&env, AttributeType::TicketId, AttributeType::SeatNumber];
    let reveal_data = vec![
        &env,
        vec![&env, 1, 2, 3, 4], // Ticket ID
        vec![&env, 9, 10, 11, 12], // Seat number
    ];
    
    let result = ZKTicketContract::reveal_attributes(
        env.clone(),
        proof_id.clone(),
        attribute_types.clone(),
        reveal_data.clone(),
    );
    
    assert!(result);
    
    let proof = ZKTicketContract::get_proof(env.clone(), proof_id);
    let ticket_id_attr = proof.attributes.iter().find(|a| a.attribute_type == AttributeType::TicketId).unwrap();
    let seat_attr = proof.attributes.iter().find(|a| a.attribute_type == AttributeType::SeatNumber).unwrap();
    let event_id_attr = proof.attributes.iter().find(|a| a.attribute_type == AttributeType::EventId).unwrap();
    
    assert!(ticket_id_attr.revealed);
    assert!(seat_attr.revealed);
    assert!(!event_id_attr.revealed); // Should still be hidden
}

#[test]
fn test_ticket_revocation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
    ];
    
    let commitment = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier.clone(),
    );
    
    // Revoke the ticket
    ZKTicketContract::revoke_ticket(
        env.clone(),
        commitment.clone(),
        Symbol::new(&env, "fraud"),
    );
    
    let stored_commitment = ZKTicketContract::get_commitment(env.clone(), commitment);
    assert!(!stored_commitment.active);
    
    // Check revocation list
    let revocation_list = ZKTicketContract::get_revocation_list(env.clone());
    assert!(revocation_list.revoked_commitments.contains(&commitment));
}

#[test]
fn test_nullifier_reuse_prevention() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let owner = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let proof_id1 = BytesN::from_array(&env, &[5; 32]);
    let proof_id2 = BytesN::from_array(&env, &[6; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
    ];
    
    let commitment = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier.clone(),
    );
    
    let proof_data = vec![&env, 1; 200];
    
    // Submit first proof
    ZKTicketContract::submit_proof(
        env.clone(),
        proof_id1.clone(),
        commitment.clone(),
        nullifier.clone(),
        event_id.clone(),
        owner.clone(),
        attributes.clone(),
        proof_data.clone(),
        env.ledger().timestamp() + 86400,
    );
    
    // Try to submit second proof with same nullifier (should fail)
    let result = std::panic::catch_unwind(|| {
        ZKTicketContract::submit_proof(
            env.clone(),
            proof_id2.clone(),
            commitment.clone(),
            nullifier.clone(),
            event_id.clone(),
            owner.clone(),
            attributes.clone(),
            proof_data.clone(),
            env.ledger().timestamp() + 86400,
        );
    });
    assert!(result.is_err());
}

#[test]
fn test_proof_expiration() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event_id = Address::generate(&env);
    let owner = Address::generate(&env);
    let ticket_hash = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let proof_id = BytesN::from_array(&env, &[5; 32]);
    
    let circuit_params = CircuitParameters {
        circuit_hash: BytesN::from_array(&env, &[1; 32]),
        proving_key_hash: BytesN::from_array(&env, &[2; 32]),
        verification_key_hash: BytesN::from_array(&env, &[3; 32]),
        attribute_count: 5,
        public_inputs: 2,
        private_inputs: 3,
    };

    ZKTicketContract::initialize(env.clone(), admin.clone(), circuit_params);
    
    let attributes = vec![
        &env,
        ZKAttribute {
            attribute_type: AttributeType::TicketId,
            value: vec![&env, 1, 2, 3, 4],
            revealed: false,
            commitment: BytesN::from_array(&env, &[3; 32]),
        },
        ZKAttribute {
            attribute_type: AttributeType::EventId,
            value: vec![&env, 5, 6, 7, 8],
            revealed: false,
            commitment: BytesN::from_array(&env, &[4; 32]),
        },
    ];
    
    let commitment = ZKTicketContract::create_ticket_commitment(
        env.clone(),
        event_id.clone(),
        ticket_hash.clone(),
        attributes.clone(),
        nullifier.clone(),
    );
    
    let proof_data = vec![&env, 1; 200];
    
    // Try to submit proof with past expiration (should fail)
    let result = std::panic::catch_unwind(|| {
        ZKTicketContract::submit_proof(
            env.clone(),
            proof_id.clone(),
            commitment.clone(),
            nullifier.clone(),
            event_id.clone(),
            owner.clone(),
            attributes.clone(),
            proof_data.clone(),
            env.ledger().timestamp() - 86400, // Expired 24 hours ago
        );
    });
    assert!(result.is_err());
}
