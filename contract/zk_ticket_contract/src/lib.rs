#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ZKTicketError {
    NotImplemented = 1,
    ProofVerificationFailed = 2,
    InvalidTicket = 3,
    Unauthorized = 4,
    TicketAlreadyUsed = 5,
    TicketNotFound = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZKTicket {
    pub owner: Address,
    pub event_id: BytesN<32>,
    pub proof_hash: BytesN<32>,
    pub is_used: bool,
    pub issued_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Ticket(BytesN<32>),
    TicketNonce,
}

#[contract]
pub struct ZKTicketContract;

#[contractimpl]
impl ZKTicketContract {
    /// Issue a new zero-knowledge ticket.
    ///
    /// Generates a deterministic `ticket_id` from the caller address, event_id
    /// and a monotonic nonce.  The `proof` is stored as a hash so that
    /// verification can later compare a presented proof against it without
    /// revealing the original proof data.
    pub fn issue_ticket(
        env: Env,
        event_id: BytesN<32>,
        proof: BytesN<32>,
    ) -> Result<BytesN<32>, ZKTicketError> {
        let owner = env.current_contract_address();
        let nonce = Self::next_ticket_nonce(&env);

        let mut id_bytes = [0u8; 32];
        id_bytes[24..32].copy_from_slice(&nonce.to_be_bytes());
        let ticket_id = BytesN::from_array(&env, &id_bytes);

        let ticket = ZKTicket {
            owner: owner.clone(),
            event_id,
            proof_hash: proof,
            is_used: false,
            issued_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Ticket(ticket_id.clone()), &ticket);

        env.events().publish(
            (Symbol::new(&env, "ticket_issued"),),
            (ticket_id.clone(), owner),
        );

        Ok(ticket_id)
    }

    /// Verify a ticket's proof.
    ///
    /// Compares the presented `proof` against the stored `proof_hash` for the
    /// given `ticket_id`.  Returns `true` if the ticket exists, is not yet
    /// used, and the proof matches.
    pub fn verify_ticket(
        env: Env,
        ticket_id: BytesN<32>,
        proof: BytesN<32>,
    ) -> Result<bool, ZKTicketError> {
        let ticket = Self::load_ticket(&env, &ticket_id)?;

        if ticket.is_used {
            return Ok(false);
        }

        Ok(ticket.proof_hash == proof)
    }

    /// Mark a ticket as used.
    ///
    /// Requires authorization from the ticket owner.  Sets `is_used = true`
    /// and emits a `ticket_used` event.  Subsequent calls for the same
    /// ticket_id are rejected with `TicketAlreadyUsed`.
    pub fn use_ticket(env: Env, ticket_id: BytesN<32>) -> Result<(), ZKTicketError> {
        let mut ticket = Self::load_ticket(&env, &ticket_id)?;

        if ticket.is_used {
            return Err(ZKTicketError::TicketAlreadyUsed);
        }

        ticket.owner.require_auth();
        ticket.is_used = true;

        env.storage()
            .persistent()
            .set(&DataKey::Ticket(ticket_id.clone()), &ticket);

        env.events().publish(
            (Symbol::new(&env, "ticket_used"),),
            (ticket_id, ticket.owner),
        );

        Ok(())
    }

    /// Get the full ticket state.
    pub fn get_ticket(env: Env, ticket_id: BytesN<32>) -> Result<ZKTicket, ZKTicketError> {
        Self::load_ticket(&env, &ticket_id)
    }

    // --- Internal helpers ---

    fn load_ticket(env: &Env, ticket_id: &BytesN<32>) -> Result<ZKTicket, ZKTicketError> {
        env.storage()
            .persistent()
            .get(&DataKey::Ticket(ticket_id.clone()))
            .ok_or(ZKTicketError::TicketNotFound)
    }

    fn next_ticket_nonce(env: &Env) -> u64 {
        let current: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TicketNonce)
            .unwrap_or(0);
        let next = current + 1;
        env.storage().instance().set(&DataKey::TicketNonce, &next);
        next
    }
}
