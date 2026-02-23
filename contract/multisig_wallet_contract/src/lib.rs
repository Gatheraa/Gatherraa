#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, WalletConfig, Signer, Role, Transaction, TransactionStatus, 
                   Batch, BatchStatus, TimelockQueue, DailySpending, NonceManager, MultisigError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct MultisigWalletContract;

#[contractimpl]
impl MultisigWalletContract {
    // Initialize the wallet
    pub fn initialize(e: Env, admin: Address, config: WalletConfig, initial_signers: Vec<Address>) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        // Validate config
        Self::validate_config(&config);

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::WalletConfig, &config);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        e.storage().instance().set(&DataKey::Frozen, &false);
        
        // Initialize nonce manager
        let nonce_manager = NonceManager {
            current_nonce: 0,
            used_nonces: map![&e],
        };
        e.storage().instance().set(&DataKey::Nonce, &nonce_manager);
        
        // Initialize timelock queue
        let timelock_queue = TimelockQueue {
            pending: Vec::new(&e),
            ready: Vec::new(&e),
            executed: Vec::new(&e),
        };
        e.storage().instance().set(&DataKey::TimelockQueue, &timelock_queue);
        
        // Add initial signers as owners
        for signer_address in initial_signers.iter() {
            Self::add_signer_internal(&e, signer_address.clone(), Role::Owner, 1);
        }
    }

    // Add a new signer
    pub fn add_signer(e: Env, signer_address: Address, role: Role, weight: u32) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        Self::add_signer_internal(&e, signer_address, role, weight);
    }

    // Remove a signer
    pub fn remove_signer(e: Env, signer_address: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(&e));
        
        // Check if signer exists
        let signer_index = signers.iter().position(|s| s.address == signer_address)
            .unwrap_or_else(|| panic!("signer not found"));

        let signer = signers.get(signer_index).unwrap();
        
        // Cannot remove if it would make m > n
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if signers.len() - 1 < config.m {
            panic!("cannot remove signer: would make m > n");
        }

        // Remove signer
        signers.remove(signer_index);
        e.storage().persistent().set(&DataKey::Signers, &signers);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("signer_removed"), signer_address.clone()),
            (),
        );
    }

    // Propose a transaction
    pub fn propose_transaction(
        e: Env,
        to: Address,
        token: Address,
        amount: i128,
        data: Vec<u8>,
        proposer: Address,
        nonce: u64,
    ) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        let frozen: bool = e.storage().instance().get(&DataKey::Frozen).unwrap();
        if frozen {
            panic!("wallet is frozen");
        }

        // Validate nonce
        Self::validate_nonce(&e, &proposer, nonce)?;

        // Validate proposer is active signer
        Self::validate_signer(&e, &proposer)?;

        // Generate transaction ID
        let transaction_id = Self::generate_transaction_id(&e, &to, &token, amount, &proposer, nonce);

        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        
        // Check if timelock is required
        let timelock_until = if amount >= config.timelock_threshold {
            e.ledger().timestamp() + config.timelock_duration
        } else {
            0
        };

        let transaction = Transaction {
            id: transaction_id.clone(),
            to: to.clone(),
            token: token.clone(),
            amount,
            data: data.clone(),
            proposer: proposer.clone(),
            signatures: Vec::new(&e),
            status: TransactionStatus::Proposed,
            created_at: e.ledger().timestamp(),
            expires_at: e.ledger().timestamp() + config.transaction_expiry,
            timelock_until,
            batch_id: None,
        };

        // Store transaction
        e.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Add to timelock queue if needed
        if timelock_until > 0 {
            let mut queue: TimelockQueue = e.storage().instance().get(&DataKey::TimelockQueue).unwrap();
            queue.pending.push_back(transaction_id.clone());
            e.storage().instance().set(&DataKey::TimelockQueue, &queue);
        }

        // Mark nonce as used
        Self::use_nonce(&e, &proposer, nonce);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("transaction_proposed"), transaction_id.clone()),
            (to, token, amount, proposer),
        );

        transaction_id
    }

    // Sign a transaction
    pub fn sign_transaction(e: Env, transaction_id: BytesN<32>, signer: Address) {
        signer.require_auth();

        let mut transaction: Transaction = e.storage().instance().get(&DataKey::Transaction(transaction_id.clone()))
            .unwrap_or_else(|| panic!("transaction not found"));

        if transaction.status != TransactionStatus::Proposed {
            panic!("invalid transaction status");
        }

        if e.ledger().timestamp() > transaction.expires_at {
            panic!("transaction expired");
        }

        // Validate signer
        Self::validate_signer(&e, &signer)?;

        // Check if already signed
        if transaction.signatures.contains(&signer) {
            panic!("already signed");
        }

        // Add signature
        transaction.signatures.push_back(signer.clone());
        e.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Check if transaction is approved
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if Self::has_required_signatures(&e, &transaction, config.m) {
            transaction.status = TransactionStatus::Approved;
            e.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

            #[allow(deprecated)]
            e.events().publish(
                (symbol_short!("transaction_approved"), transaction_id.clone()),
                signer,
            );
        }

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("transaction_signed"), transaction_id.clone()),
            signer,
        );
    }

    // Execute a transaction
    pub fn execute_transaction(e: Env, transaction_id: BytesN<32>) {
        let mut transaction: Transaction = e.storage().instance().get(&DataKey::Transaction(transaction_id.clone()))
            .unwrap_or_else(|| panic!("transaction not found"));

        if transaction.status != TransactionStatus::Approved {
            panic!("transaction not approved");
        }

        if e.ledger().timestamp() > transaction.expires_at {
            panic!("transaction expired");
        }

        // Check timelock
        if transaction.timelock_until > 0 && e.ledger().timestamp() < transaction.timelock_until {
            panic!("timelock not expired");
        }

        // Check daily spending limit
        Self::check_daily_spending(&e, &transaction)?;

        // Execute transaction
        let token_client = soroban_sdk::token::Client::new(&e, &transaction.token);
        let contract_address = e.current_contract_address();
        
        token_client.transfer(&contract_address, &transaction.to, &transaction.amount);

        // Update transaction status
        transaction.status = TransactionStatus::Executed;
        e.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Update daily spending
        Self::update_daily_spending(&e, &transaction);

        // Update timelock queue
        if transaction.timelock_until > 0 {
            let mut queue: TimelockQueue = e.storage().instance().get(&DataKey::TimelockQueue).unwrap();
            queue.ready.remove_first(|id| id == &transaction_id);
            queue.executed.push_back(transaction_id.clone());
            e.storage().instance().set(&DataKey::TimelockQueue, &queue);
        }

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("transaction_executed"), transaction_id.clone()),
            transaction.amount,
        );
    }

    // Propose a batch transaction
    pub fn propose_batch(
        e: Env,
        transactions: Vec<BytesN<32>>,
        proposer: Address,
        nonce: u64,
    ) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        let frozen: bool = e.storage().instance().get(&DataKey::Frozen).unwrap();
        if frozen {
            panic!("wallet is frozen");
        }

        // Validate nonce
        Self::validate_nonce(&e, &proposer, nonce)?;

        // Validate proposer is active signer
        Self::validate_signer(&e, &proposer)?;

        // Validate batch size
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if transactions.len() > config.max_batch_size as usize {
            panic!("batch size exceeded");
        }

        // Validate all transactions exist and are proposed
        for tx_id in transactions.iter() {
            let tx: Transaction = e.storage().instance().get(&DataKey::Transaction(tx_id.clone()))
                .unwrap_or_else(|| panic!("transaction not found"));
            
            if tx.status != TransactionStatus::Proposed {
                panic!("invalid transaction status in batch");
            }

            if tx.batch_id.is_some() {
                panic!("transaction already in batch");
            }
        }

        // Generate batch ID
        let batch_id = Self::generate_batch_id(&e, &transactions, &proposer, nonce);

        let batch = Batch {
            id: batch_id.clone(),
            transactions: transactions.clone(),
            proposer: proposer.clone(),
            signatures: Vec::new(&e),
            status: BatchStatus::Proposed,
            created_at: e.ledger().timestamp(),
            expires_at: e.ledger().timestamp() + config.transaction_expiry,
        };

        // Store batch
        e.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        // Update transactions to reference batch
        for tx_id in transactions.iter() {
            let mut tx: Transaction = e.storage().instance().get(&DataKey::Transaction(tx_id.clone())).unwrap();
            tx.batch_id = Some(batch_id.clone());
            e.storage().instance().set(&DataKey::Transaction(tx_id.clone()), &tx);
        }

        // Mark nonce as used
        Self::use_nonce(&e, &proposer, nonce);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("batch_proposed"), batch_id.clone()),
            (transactions.len(), proposer),
        );

        batch_id
    }

    // Sign a batch
    pub fn sign_batch(e: Env, batch_id: BytesN<32>, signer: Address) {
        signer.require_auth();

        let mut batch: Batch = e.storage().instance().get(&DataKey::Batch(batch_id.clone()))
            .unwrap_or_else(|| panic!("batch not found"));

        if batch.status != BatchStatus::Proposed {
            panic!("invalid batch status");
        }

        if e.ledger().timestamp() > batch.expires_at {
            panic!("batch expired");
        }

        // Validate signer
        Self::validate_signer(&e, &signer)?;

        // Check if already signed
        if batch.signatures.contains(&signer) {
            panic!("already signed");
        }

        // Add signature
        batch.signatures.push_back(signer.clone());
        e.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        // Check if batch is approved
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if Self::has_required_signatures_batch(&e, &batch, config.m) {
            batch.status = BatchStatus::Approved;
            e.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

            #[allow(deprecated)]
            e.events().publish(
                (symbol_short!("batch_approved"), batch_id.clone()),
                signer,
            );
        }

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("batch_signed"), batch_id.clone()),
            signer,
        );
    }

    // Execute a batch
    pub fn execute_batch(e: Env, batch_id: BytesN<32>) {
        let batch: Batch = e.storage().instance().get(&DataKey::Batch(batch_id.clone()))
            .unwrap_or_else(|| panic!("batch not found"));

        if batch.status != BatchStatus::Approved {
            panic!("batch not approved");
        }

        if e.ledger().timestamp() > batch.expires_at {
            panic!("batch expired");
        }

        // Execute all transactions in batch
        for tx_id in batch.transactions.iter() {
            let mut tx: Transaction = e.storage().instance().get(&DataKey::Transaction(tx_id.clone())).unwrap();
            
            if tx.status == TransactionStatus::Approved {
                // Execute transaction
                let token_client = soroban_sdk::token::Client::new(&e, &tx.token);
                let contract_address = e.current_contract_address();
                
                token_client.transfer(&contract_address, &tx.to, &tx.amount);

                tx.status = TransactionStatus::Executed;
                e.storage().instance().set(&DataKey::Transaction(tx_id.clone()), &tx);

                // Update daily spending
                Self::update_daily_spending(&e, &tx);
            }
        }

        // Update batch status
        let mut batch = batch;
        batch.status = BatchStatus::Executed;
        e.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("batch_executed"), batch_id.clone()),
            batch.transactions.len(),
        );
    }

    // Emergency freeze
    pub fn emergency_freeze(e: Env, duration: u64) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        e.storage().instance().set(&DataKey::Frozen, &true);
        
        // Schedule unfreeze
        e.storage().instance().set(&symbol_short!("unfreeze_time"), &(e.ledger().timestamp() + duration));

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("emergency_freeze"),),
            duration,
        );
    }

    // Unfreeze (can be called by admin or after timeout)
    pub fn unfreeze(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        let unfreeze_time: Option<u64> = e.storage().instance().get(&symbol_short!("unfreeze_time"));

        let caller = e.current_contract_address();
        
        // Allow admin to unfreeze anytime or anyone after timeout
        if caller != admin {
            if let Some(time) = unfreeze_time {
                if e.ledger().timestamp() < time {
                    admin.require_auth(); // Require admin if timeout not reached
                }
            } else {
                admin.require_auth(); // No timeout set, require admin
            }
        }

        e.storage().instance().set(&DataKey::Frozen, &false);
        e.storage().instance().remove(&symbol_short!("unfreeze_time"));

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("unfrozen"),),
            (),
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

    pub fn update_config(e: Env, new_config: WalletConfig) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        Self::validate_config(&new_config);
        e.storage().instance().set(&DataKey::WalletConfig, &new_config);
    }

    // View functions
    pub fn get_config(e: Env) -> WalletConfig {
        e.storage().instance().get(&DataKey::WalletConfig).unwrap()
    }

    pub fn get_signers(e: Env) -> Vec<Signer> {
        e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(&e))
    }

    pub fn get_transaction(e: Env, transaction_id: BytesN<32>) -> Transaction {
        e.storage().instance().get(&DataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("transaction not found"))
    }

    pub fn get_batch(e: Env, batch_id: BytesN<32>) -> Batch {
        e.storage().instance().get(&DataKey::Batch(batch_id))
            .unwrap_or_else(|| panic!("batch not found"))
    }

    pub fn get_daily_spending(e: Env) -> DailySpending {
        let today = Self::get_today_timestamp(&e);
        e.storage().persistent().get(&DataKey::DailySpending(today))
            .unwrap_or(DailySpending {
                date: today,
                spent: 0,
                limit: Self::get_config(e).daily_spending_limit,
            })
    }

    pub fn is_frozen(e: Env) -> bool {
        e.storage().instance().get(&DataKey::Frozen).unwrap_or(false)
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn validate_config(config: &WalletConfig) {
        if config.m == 0 || config.n == 0 {
            panic!("m and n must be greater than 0");
        }

        if config.m > config.n {
            panic!("m cannot be greater than n");
        }

        if config.daily_spending_limit <= 0 {
            panic!("daily spending limit must be positive");
        }

        if config.timelock_threshold <= 0 {
            panic!("timelock threshold must be positive");
        }

        if config.max_batch_size == 0 {
            panic!("max batch size must be positive");
        }
    }

    fn add_signer_internal(e: &Env, signer_address: Address, role: Role, weight: u32) {
        let mut signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(e));
        
        // Check if signer already exists
        if signers.iter().any(|s| s.address == signer_address) {
            panic!("signer already exists");
        }

        let signer = Signer {
            address: signer_address.clone(),
            role,
            weight,
            daily_spent: 0,
            last_spending_reset: e.ledger().timestamp(),
            active: true,
            added_at: e.ledger().timestamp(),
        };

        signers.push_back(signer);
        e.storage().persistent().set(&DataKey::Signers, &signers);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("signer_added"), signer_address.clone()),
            (),
        );
    }

    fn validate_signer(e: &Env, signer: &Address) -> Result<(), MultisigError> {
        let signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(e));
        
        for s in signers.iter() {
            if s.address == signer {
                if !s.active {
                    return Err(MultisigError::SignerNotActive);
                }
                return Ok(());
            }
        }
        
        Err(MultisigError::InvalidSigner)
    }

    fn validate_nonce(e: &Env, signer: &Address, nonce: u64) -> Result<(), MultisigError> {
        let mut nonce_manager: NonceManager = e.storage().instance().get(&DataKey::Nonce).unwrap();
        
        if let Some(used_nonce) = nonce_manager.used_nonces.get(signer) {
            if nonce <= used_nonce {
                return Err(MultisigError::NonceUsed);
            }
        }
        
        Ok(())
    }

    fn use_nonce(e: &Env, signer: &Address, nonce: u64) {
        let mut nonce_manager: NonceManager = e.storage().instance().get(&DataKey::Nonce).unwrap();
        nonce_manager.used_nonces.set(signer.clone(), nonce);
        e.storage().instance().set(&DataKey::Nonce, &nonce_manager);
    }

    fn has_required_signatures(e: &Env, transaction: &Transaction, required: u32) -> bool {
        let mut total_weight = 0;
        let signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(e));
        
        for signature in transaction.signatures.iter() {
            for signer in signers.iter() {
                if signer.address == signature && signer.active {
                    total_weight += signer.weight;
                    break;
                }
            }
        }
        
        total_weight >= required
    }

    fn has_required_signatures_batch(e: &Env, batch: &Batch, required: u32) -> bool {
        let mut total_weight = 0;
        let signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(e));
        
        for signature in batch.signatures.iter() {
            for signer in signers.iter() {
                if signer.address == signature && signer.active {
                    total_weight += signer.weight;
                    break;
                }
            }
        }
        
        total_weight >= required
    }

    fn check_daily_spending(e: &Env, transaction: &Transaction) -> Result<(), MultisigError> {
        let today = Self::get_today_timestamp(e);
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        
        let mut daily_spending: DailySpending = e.storage().persistent().get(&DataKey::DailySpending(today))
            .unwrap_or(DailySpending {
                date: today,
                spent: 0,
                limit: config.daily_spending_limit,
            });
        
        if daily_spending.spent + transaction.amount > daily_spending.limit {
            return Err(MultisigError::DailySpendingLimitExceeded);
        }
        
        Ok(())
    }

    fn update_daily_spending(e: &Env, transaction: &Transaction) {
        let today = Self::get_today_timestamp(e);
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).unwrap();
        
        let mut daily_spending: DailySpending = e.storage().persistent().get(&DataKey::DailySpending(today))
            .unwrap_or(DailySpending {
                date: today,
                spent: 0,
                limit: config.daily_spending_limit,
            });
        
        daily_spending.spent += transaction.amount;
        e.storage().persistent().set(&DataKey::DailySpending(today), &daily_spending);
    }

    fn get_today_timestamp(e: &Env) -> u64 {
        let current_time = e.ledger().timestamp();
        (current_time / 86400) * 86400 // Round down to start of day
    }

    fn generate_transaction_id(e: &Env, to: &Address, token: &Address, amount: i128, proposer: &Address, nonce: u64) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(to.to_val());
        data.push_back(token.to_val());
        data.push_back(amount.into_val(e));
        data.push_back(proposer.to_val());
        data.push_back(nonce.into_val(e));
        data.push_back(e.ledger().timestamp().to_val());
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn generate_batch_id(e: &Env, transactions: &Vec<BytesN<32>>, proposer: &Address, nonce: u64) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(transactions.len().into_val(e));
        data.push_back(proposer.to_val());
        data.push_back(nonce.into_val(e));
        data.push_back(e.ledger().timestamp().to_val());
        
        for tx_id in transactions.iter() {
            data.push_back(tx_id.to_val());
        }
        
        e.crypto().sha256(&data.to_bytes())
    }
}
