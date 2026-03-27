#![no_std]
#![deny(clippy::all)]
#![deny(clippy::pedantic)]
#![warn(clippy::nursery)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::cast_possible_truncation)]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, WalletConfig, Signer, Role, Transaction, TransactionStatus, 
                   Batch, BatchStatus, TimelockQueue, DailySpending, NonceManager, MultisigError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, BytesN, Env, IntoVal, Symbol, Vec, Map,
};
use gathera_common::{
    require_admin, is_paused, set_paused, read_version, write_version
};

#[contract]
pub struct MultisigWalletContract;

/// The Multisig Wallet Contract provides M-of-N signature governance for managing funds and executing transactions.
///
/// Features include daily spending limits, timelocks for large transactions, batch operations,
/// role-based access control for signers, and emergency freeze capabilities.
#[contractimpl]
impl MultisigWalletContract {
    /// Initializes the multisig wallet with an administrator, configuration, and initial owners.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `admin` - The address with administrative rights (pause, unpause, freeze).
    /// * `config` - Initial wallet configuration (M, N, spending limits, etc.).
    /// * `initial_signers` - List of addresses to be registered as initial owners.
    ///
    /// # Panics
    /// Panics if the contract is already initialized or if the configuration is invalid.
    pub fn initialize(env: Env, admin: Address, config: WalletConfig, initial_signers: Vec<Address>) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        Self::validate_config(&config);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::WalletConfig, &config);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Version, &1u32);
        env.storage().instance().set(&DataKey::Frozen, &false);
        
        let nonce_manager = NonceManager {
            current_nonce: 0,
            used_nonces: map![&env],
        };
        env.storage().instance().set(&DataKey::Nonce, &nonce_manager);
        
        let timelock_queue = TimelockQueue {
            pending: Vec::new(&env),
            ready: Vec::new(&env),
            executed: Vec::new(&env),
        };
        env.storage().instance().set(&DataKey::TimelockQueue, &timelock_queue);
        
        for signer_address in initial_signers.iter() {
            Self::add_signer_internal(&env, signer_address.clone(), Role::Owner, 1);
        }
    }

    /// Adds a new signer to the wallet. Only callable by the administrator.
    pub fn add_signer(env: Env, signer_address: Address, role: Role, weight: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        Self::add_signer_internal(&env, signer_address, role, weight);
    }

    /// Removes an existing signer from the wallet. Only callable by the administrator.
    pub fn remove_signer(env: Env, signer_address: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut signers: Vec<Signer> = env.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(&env));
        
        let signer_index = signers.iter().position(|s| s.address == signer_address)
            .unwrap_or_else(|| panic!("signer not found"));

        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if signers.len() - 1 < config.m {
            panic!("cannot remove signer: would make m > n");
        }

        signers.remove(signer_index);
        env.storage().persistent().set(&DataKey::Signers, &signers);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("signer_removed"), signer_address.clone()),
            (),
        );
    }

    /// Proposes a new transaction for the wallet.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `to` - Destination address for the transfer.
    /// * `token` - Token address to be used.
    /// * `amount` - Amount of tokens to transfer.
    /// * `data` - Optional data for a contract call.
    /// * `proposer` - The address proposing the transaction (must be a signer).
    /// * `nonce` - Replay protection nonce.
    ///
    /// # Returns
    /// The unique ID of the proposed transaction.
    ///
    /// # Errors
    /// Returns [MultisigError::NonceUsed] if the nonce is invalid.
    pub fn propose_transaction(
        env: Env,
        to: Address,
        token: Address,
        amount: i128,
        data: Vec<u8>,
        proposer: Address,
        nonce: u64,
    ) -> Result<BytesN<32>, MultisigError> {
        if is_paused(&env) {
            panic!("contract is paused");
        }

        let frozen: bool = env.storage().instance().get(&DataKey::Frozen).unwrap();
        if frozen {
            panic!("wallet is frozen");
        }

        Self::validate_nonce(&env, &proposer, nonce)?;

        Self::validate_signer(&env, &proposer)?;

        let transaction_id = Self::generate_transaction_id(&env, &to, &token, amount, &proposer, nonce);

        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        
        let timelock_until = if amount >= config.timelock_threshold {
            env.ledger().timestamp().checked_add(config.timelock_duration).expect("Time overflow")
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
            signatures: Vec::new(&env),
            status: TransactionStatus::Proposed,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp().checked_add(config.transaction_expiry).expect("Time overflow"),
            timelock_until,
            batch_id: None,
        };

        env.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        if timelock_until > 0 {
            let mut queue: TimelockQueue = env.storage().instance().get(&DataKey::TimelockQueue).unwrap();
            queue.pending.push_back(transaction_id.clone());
            env.storage().instance().set(&DataKey::TimelockQueue, &queue);
        }

        Self::use_nonce(&env, &proposer, nonce);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("transaction_proposed"), transaction_id.clone()),
            (to, token, amount, proposer),
        );

        Ok(transaction_id)
    }

    // Sign a transaction
    pub fn sign_transaction(env: Env, transaction_id: BytesN<32>, signer: Address) {
        signer.require_auth();

        let mut transaction: Transaction = env.storage().instance().get(&DataKey::Transaction(transaction_id.clone()))
            .unwrap_or_else(|| panic!("transaction not found"));

        if transaction.status != TransactionStatus::Proposed {
            panic!("invalid transaction status");
        }

        if env.ledger().timestamp() > transaction.expires_at {
            panic!("transaction expired");
        }

        // Validate signer
        Self::validate_signer(&env, &signer)?;

        // Check if already signed
        if transaction.signatures.contains(&signer) {
            panic!("already signed");
        }

        // Add signature
        transaction.signatures.push_back(signer.clone());
        env.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Check if transaction is approved
        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if Self::has_required_signatures(&env, &transaction, config.m) {
            transaction.status = TransactionStatus::Approved;
            env.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

            #[allow(deprecated)]
            env.events().publish(
                (symbol_short!("transaction_approved"), transaction_id.clone()),
                signer,
            );
        }

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("transaction_signed"), transaction_id.clone()),
            signer,
        );
    }

    // Execute a transaction
    pub fn execute_transaction(env: Env, transaction_id: BytesN<32>) {
        let mut transaction: Transaction = env.storage().instance().get(&DataKey::Transaction(transaction_id.clone()))
            .unwrap_or_else(|| panic!("transaction not found"));

        if transaction.status != TransactionStatus::Approved {
            panic!("transaction not approved");
        }

        if env.ledger().timestamp() > transaction.expires_at {
            panic!("transaction expired");
        }

        // Check timelock
        if transaction.timelock_until > 0 && env.ledger().timestamp() < transaction.timelock_until {
            panic!("timelock not expired");
        }

        // Check daily spending limit
        Self::check_daily_spending(&env, &transaction)?;

        // Execute transaction
        let token_client = soroban_sdk::token::Client::new(&env, &transaction.token);
        let contract_address = env.current_contract_address();
        
        token_client.transfer(&contract_address, &transaction.to, &transaction.amount);

        // Update transaction status
        transaction.status = TransactionStatus::Executed;
        env.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Update daily spending
        Self::update_daily_spending(&env, &transaction);

        // Update timelock queue
        if transaction.timelock_until > 0 {
            let mut queue: TimelockQueue = env.storage().instance().get(&DataKey::TimelockQueue).unwrap();
            queue.ready.remove_first(|id| id == &transaction_id);
            queue.executed.push_back(transaction_id.clone());
            env.storage().instance().set(&DataKey::TimelockQueue, &queue);
        }

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("transaction_executed"), transaction_id.clone()),
            transaction.amount,
        );
    }

    // Propose a batch transaction
    pub fn propose_batch(
        env: Env,
        transactions: Vec<BytesN<32>>,
        proposer: Address,
        nonce: u64,
    ) -> BytesN<32> {
        if is_paused(&env) {
            panic!("contract is paused");
        }

        let frozen: bool = env.storage().instance().get(&DataKey::Frozen).unwrap();
        if frozen {
            panic!("wallet is frozen");
        }

        // Validate nonce
        Self::validate_nonce(&env, &proposer, nonce)?;

        // Validate proposer is active signer
        Self::validate_signer(&env, &proposer)?;

        // Validate batch size
        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if transactions.len() > config.max_batch_size as usize {
            panic!("batch size exceeded");
        }

        // Validate all transactions exist and are proposed
        for tx_id in transactions.iter() {
            let tx: Transaction = env.storage().instance().get(&DataKey::Transaction(tx_id.clone()))
                .unwrap_or_else(|| panic!("transaction not found"));
            
            if tx.status != TransactionStatus::Proposed {
                panic!("invalid transaction status in batch");
            }

            if tx.batch_id.is_some() {
                panic!("transaction already in batch");
            }
        }

        // Generate batch ID
        let batch_id = Self::generate_batch_id(&env, &transactions, &proposer, nonce);

        let batch = Batch {
            id: batch_id.clone(),
            transactions: transactions.clone(),
            proposer: proposer.clone(),
            signatures: Vec::new(&env),
            status: BatchStatus::Proposed,
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp().checked_add(config.transaction_expiry).expect("Time overflow"),
        };

        // Store batch
        env.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        // Update transactions to reference batch
        for tx_id in transactions.iter() {
            let mut tx: Transaction = env.storage().instance().get(&DataKey::Transaction(tx_id.clone())).unwrap();
            tx.batch_id = Some(batch_id.clone());
            env.storage().instance().set(&DataKey::Transaction(tx_id.clone()), &tx);
        }

        // Mark nonce as used
        Self::use_nonce(&env, &proposer, nonce);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("batch_proposed"), batch_id.clone()),
            (transactions.len(), proposer),
        );

        batch_id
    }

    // Sign a batch
    pub fn sign_batch(env: Env, batch_id: BytesN<32>, signer: Address) {
        signer.require_auth();

        let mut batch: Batch = env.storage().instance().get(&DataKey::Batch(batch_id.clone()))
            .unwrap_or_else(|| panic!("batch not found"));

        if batch.status != BatchStatus::Proposed {
            panic!("invalid batch status");
        }

        if env.ledger().timestamp() > batch.expires_at {
            panic!("batch expired");
        }

        // Validate signer
        Self::validate_signer(&env, &signer)?;

        // Check if already signed
        if batch.signatures.contains(&signer) {
            panic!("already signed");
        }

        // Add signature
        batch.signatures.push_back(signer.clone());
        env.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        // Check if batch is approved
        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        if Self::has_required_signatures_batch(&env, &batch, config.m) {
            batch.status = BatchStatus::Approved;
            env.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

            #[allow(deprecated)]
            env.events().publish(
                (symbol_short!("batch_approved"), batch_id.clone()),
                signer,
            );
        }

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("batch_signed"), batch_id.clone()),
            signer,
        );
    }

    // Execute a batch
    pub fn execute_batch(env: Env, batch_id: BytesN<32>) {
        let batch: Batch = env.storage().instance().get(&DataKey::Batch(batch_id.clone()))
            .unwrap_or_else(|| panic!("batch not found"));

        if batch.status != BatchStatus::Approved {
            panic!("batch not approved");
        }

        if env.ledger().timestamp() > batch.expires_at {
            panic!("batch expired");
        }

        // Execute all transactions in batch
        for tx_id in batch.transactions.iter() {
            let mut tx: Transaction = env.storage().instance().get(&DataKey::Transaction(tx_id.clone())).unwrap();
            
            if tx.status == TransactionStatus::Approved {
                // Execute transaction
                let token_client = soroban_sdk::token::Client::new(&env, &tx.token);
                let contract_address = env.current_contract_address();
                
                token_client.transfer(&contract_address, &tx.to, &tx.amount);

                tx.status = TransactionStatus::Executed;
                env.storage().instance().set(&DataKey::Transaction(tx_id.clone()), &tx);

                // Update daily spending
                Self::update_daily_spending(&env, &tx);
            }
        }

        // Update batch status
        let mut batch = batch;
        batch.status = BatchStatus::Executed;
        env.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("batch_executed"), batch_id.clone()),
            batch.transactions.len(),
        );
    }

    // Emergency freeze
    pub fn emergency_freeze(env: Env, duration: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().set(&DataKey::Frozen, &true);
        
        // Schedule unfreeze
        env.storage().instance().set(&symbol_short!("unfreeze_time"), &(env.ledger().timestamp().checked_add(duration).expect("Time overflow")));

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("emergency_freeze"),),
            duration,
        );
    }

    // Unfreeze (can be called by admin or after timeout)
    pub fn unfreeze(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        let unfreeze_time: Option<u64> = env.storage().instance().get(&symbol_short!("unfreeze_time"));

        let caller = env.current_contract_address();
        
        // Allow admin to unfreeze anytime or anyone after timeout
        if caller != admin {
            if let Some(time) = unfreeze_time {
                if env.ledger().timestamp() < time {
                    admin.require_auth(); // Require admin if timeout not reached
                }
            } else {
                admin.require_auth(); // No timeout set, require admin
            }
        }

        env.storage().instance().set(&DataKey::Frozen, &false);
        env.storage().instance().remove(&symbol_short!("unfreeze_time"));

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("unfrozen"),),
            (),
        );
    }

    // Admin functions
    pub fn pause(env: Env) {
        require_admin(&env);
        set_paused(&env, true);
    }

    pub fn unpause(env: Env) {
        require_admin(&env);
        set_paused(&env, false);
    }

    pub fn update_config(env: Env, new_config: WalletConfig) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        Self::validate_config(&new_config);
        env.storage().instance().set(&DataKey::WalletConfig, &new_config);
    }

    // View functions
    pub fn get_config(env: Env) -> WalletConfig {
        env.storage().instance().get(&DataKey::WalletConfig).unwrap()
    }

    pub fn get_signers(env: Env) -> Vec<Signer> {
        env.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(&env))
    }

    pub fn get_transaction(env: Env, transaction_id: BytesN<32>) -> Transaction {
        env.storage().instance().get(&DataKey::Transaction(transaction_id))
            .unwrap_or_else(|| panic!("transaction not found"))
    }

    pub fn get_batch(env: Env, batch_id: BytesN<32>) -> Batch {
        env.storage().instance().get(&DataKey::Batch(batch_id))
            .unwrap_or_else(|| panic!("batch not found"))
    }

    pub fn get_daily_spending(env: Env) -> DailySpending {
        let today = Self::get_today_timestamp(&env);
        env.storage().persistent().get(&DataKey::DailySpending(today))
            .unwrap_or(DailySpending {
                date: today,
                spent: 0,
                limit: Self::get_config(env).daily_spending_limit,
            })
    }

    pub fn is_frozen(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Frozen).unwrap_or(false)
    }

    pub fn version(env: Env) -> u32 {
        read_version(&env)
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

    fn add_signer_internal(env: &Env, signer_address: Address, role: Role, weight: u32) {
        let mut signers: Vec<Signer> = env.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(env));
        
        // Check if signer already exists
        if signers.iter().any(|s| s.address == signer_address) {
            panic!("signer already exists");
        }

        let signer = Signer {
            address: signer_address.clone(),
            role,
            weight,
            daily_spent: 0,
            last_spending_reset: env.ledger().timestamp(),
            active: true,
            added_at: env.ledger().timestamp(),
        };

        signers.push_back(signer);
        env.storage().persistent().set(&DataKey::Signers, &signers);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("signer_added"), signer_address.clone()),
            (),
        );
    }

    fn validate_signer(env: &Env, signer: &Address) -> Result<(), MultisigError> {
        let signers: Vec<Signer> = env.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(env));
        
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

    fn validate_nonce(env: &Env, signer: &Address, nonce: u64) -> Result<(), MultisigError> {
        let nonce_manager: NonceManager = env.storage().instance().get(&DataKey::Nonce).unwrap();
        
        if let Some(used_nonce) = nonce_manager.used_nonces.get(signer) {
            if nonce <= used_nonce {
                return Err(MultisigError::NonceUsed);
            }
        }
        
        Ok(())
    }

    fn use_nonce(env: &Env, signer: &Address, nonce: u64) {
        let mut nonce_manager: NonceManager = env.storage().instance().get(&DataKey::Nonce).unwrap();
        nonce_manager.used_nonces.set(signer.clone(), nonce);
        env.storage().instance().set(&DataKey::Nonce, &nonce_manager);
    }

    fn has_required_signatures(e: &Env, transaction: &Transaction, required: u32) -> bool {
        let mut total_weight = 0;
        let signers: Vec<Signer> = env.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(e));
        
        for signature in transaction.signatures.iter() {
            for signer in signers.iter() {
                if signer.address == signature && signer.active {
                    total_weight = total_weight.checked_add(signer.weight).expect("Weight overflow");
                    break;
                }
            }
        }
        
        total_weight >= required
    }

    fn has_required_signatures_batch(e: &Env, batch: &Batch, required: u32) -> bool {
        let mut total_weight = 0;
        let signers: Vec<Signer> = env.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(e));
        
        for signature in batch.signatures.iter() {
            for signer in signers.iter() {
                if signer.address == signature && signer.active {
                    total_weight = total_weight.checked_add(signer.weight).expect("Weight overflow");
                    break;
                }
            }
        }
        
        total_weight >= required
    }

    fn check_daily_spending(env: &Env, transaction: &Transaction) -> Result<(), MultisigError> {
        let today = Self::get_today_timestamp(env);
        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        
        let daily_spending: DailySpending = env.storage().persistent().get(&DataKey::DailySpending(today))
            .unwrap_or(DailySpending {
                date: today,
                spent: 0,
                limit: config.daily_spending_limit,
            });
        
        let total_spent_today = daily_spending.spent.checked_add(transaction.amount).expect("Spending overflow");
        if total_spent_today > daily_spending.limit {
            return Err(MultisigError::DailySpendingLimitExceeded);
        }
        
        Ok(())
    }

    fn update_daily_spending(env: &Env, transaction: &Transaction) {
        let today = Self::get_today_timestamp(env);
        let config: WalletConfig = env.storage().instance().get(&DataKey::WalletConfig).unwrap();
        
        let mut daily_spending: DailySpending = env.storage().persistent().get(&DataKey::DailySpending(today))
            .unwrap_or(DailySpending {
                date: today,
                spent: 0,
                limit: config.daily_spending_limit,
            });
        
        daily_spending.spent = daily_spending.spent.checked_add(transaction.amount).expect("Spending overflow");
        env.storage().persistent().set(&DataKey::DailySpending(today), &daily_spending);
    }

    fn get_today_timestamp(env: &Env) -> u64 {
        let current_time = env.ledger().timestamp();
        (current_time / 86400) * 86400 // Round down to start of day
    }

    fn generate_transaction_id(env: &Env, to: &Address, token: &Address, amount: i128, proposer: &Address, nonce: u64) -> BytesN<32> {
        let mut data = Vec::new(env);
        data.push_back(to.to_val());
        data.push_back(token.to_val());
        data.push_back(amount.into_val(env));
        data.push_back(proposer.to_val());
        data.push_back(nonce.into_val(env));
        data.push_back(env.ledger().timestamp().to_val());
        
        env.crypto().sha256(&data.to_bytes())
    }

    fn generate_batch_id(env: &Env, transactions: &Vec<BytesN<32>>, proposer: &Address, nonce: u64) -> BytesN<32> {
        let mut data = Vec::new(env);
        data.push_back(transactions.len().into_val(env));
        data.push_back(proposer.to_val());
        data.push_back(nonce.into_val(env));
        data.push_back(env.ledger().timestamp().to_val());
        
        for tx_id in transactions.iter() {
            data.push_back(tx_id.to_val());
        }
        
        env.crypto().sha256(&data.to_bytes())
    }
}
