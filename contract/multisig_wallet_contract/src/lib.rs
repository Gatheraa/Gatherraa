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
    pub fn initialize(e: Env, admin: Address, config: WalletConfig, initial_signers: Vec<Address>) -> Result<(), MultisigError> {
        if e.storage().instance().has(&DataKey::Admin) {
            return Err(MultisigError::AlreadyInitialized);
        }

        // Validate config
        Self::validate_config(&config)?;

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::WalletConfig, &config);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        e.storage().instance().set(&DataKey::Frozen, &false);
        
        // Initialize timelock queue
        let timelock_queue = TimelockQueue {
            pending: Vec::new(&e),
            ready: Vec::new(&e),
            executed: Vec::new(&e),
        };
        e.storage().instance().set(&DataKey::TimelockQueue, &timelock_queue);
        
        // Add initial signers as owners
        for signer_address in initial_signers.iter() {
            Self::add_signer_internal(&e, signer_address.clone(), Role::Owner, 1)?;
        }
        Ok(())
    }

    // Add a new signer
    pub fn add_signer(e: Env, signer_address: Address, role: Role, weight: u32) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        admin.require_auth();

        Self::add_signer_internal(&e, signer_address, role, weight)
    }

    // Remove a signer
    pub fn remove_signer(e: Env, signer_address: Address) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        admin.require_auth();

        let mut signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or_else(|| Vec::new(&e));
        
        let signer_index = signers.iter().position(|s| s.address == signer_address)
            .ok_or(MultisigError::SignerNotFound)?;

        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).ok_or(MultisigError::NotInitialized)?;
        if signers.len() - 1 < config.m {
            return Err(MultisigError::InvalidConfig);
        }

        signers.remove(signer_index);
        e.storage().persistent().set(&DataKey::Signers, &signers);

        e.events().publish(
            (symbol_short!("sig_rem"), signer_address.clone()),
            (),
        );
        Ok(())
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
    ) -> Result<BytesN<32>, MultisigError> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            return Err(MultisigError::ContractPaused);
        }

        let frozen: bool = e.storage().instance().get(&DataKey::Frozen).unwrap_or(false);
        if frozen {
            return Err(MultisigError::WalletFrozen);
        }

        proposer.require_auth();

        // Validate nonce
        Self::validate_nonce(&e, &proposer, nonce)?;

        // Validate proposer is active signer
        Self::validate_signer(&e, &proposer)?;

        // Generate transaction ID
        let transaction_id = Self::generate_transaction_id(&e, &to, &token, amount, &proposer, nonce);

        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig)
            .ok_or(MultisigError::NotInitialized)?;
        
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

        e.events().publish(
            (symbol_short!("tx_prop"), transaction_id.clone()),
            (to, token, amount, proposer),
        );

        Ok(transaction_id)
    }

    // Sign a transaction
    pub fn sign_transaction(e: Env, transaction_id: BytesN<32>, signer: Address) -> Result<(), MultisigError> {
        signer.require_auth();

        let mut transaction: Transaction = e.storage().instance().get(&DataKey::Transaction(transaction_id.clone()))
            .ok_or(MultisigError::TransactionNotFound)?;

        if transaction.status != TransactionStatus::Proposed {
            return Err(MultisigError::InvalidTransactionStatus);
        }

        if e.ledger().timestamp() > transaction.expires_at {
            return Err(MultisigError::TransactionExpired);
        }

        // Validate signer
        Self::validate_signer(&e, &signer)?;

        // Check if already signed
        if transaction.signatures.contains(&signer) {
            return Err(MultisigError::AlreadySigned);
        }

        // Add signature
        transaction.signatures.push_back(signer.clone());

        // Check if transaction is approved
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).ok_or(MultisigError::NotInitialized)?;
        if Self::has_required_signatures(&e, &transaction, config.m) {
            transaction.status = TransactionStatus::Approved;
            e.events().publish(
                (symbol_short!("tx_app"), transaction_id.clone()),
                signer.clone(),
            );
        }

        e.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);
        e.events().publish(
            (symbol_short!("tx_sig"), transaction_id.clone()),
            signer,
        );
        Ok(())
    }

    // Execute a transaction
    pub fn execute_transaction(e: Env, transaction_id: BytesN<32>) -> Result<(), MultisigError> {
        let mut transaction: Transaction = e.storage().instance().get(&DataKey::Transaction(transaction_id.clone()))
            .ok_or(MultisigError::TransactionNotFound)?;

        if transaction.status != TransactionStatus::Approved {
            return Err(MultisigError::InvalidTransactionStatus);
        }

        if e.ledger().timestamp() > transaction.expires_at {
            return Err(MultisigError::TransactionExpired);
        }

        // Check timelock
        if transaction.timelock_until > 0 && e.ledger().timestamp() < transaction.timelock_until {
            return Err(MultisigError::TimelockNotExpired);
        }

        // Check daily spending limit
        Self::check_daily_spending(&e, &transaction)?;

        // Execute transaction
        let token_client = soroban_sdk::token::Client::new(&e, &transaction.token);
        token_client.transfer(&e.current_contract_address(), &transaction.to, &transaction.amount);

        // Update transaction status
        transaction.status = TransactionStatus::Executed;
        e.storage().instance().set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Update daily spending
        Self::update_daily_spending(&e, &transaction);

        // Update timelock queue
        if transaction.timelock_until > 0 {
            if let Some(mut queue) = e.storage().instance().get::<_, TimelockQueue>(&DataKey::TimelockQueue) {
                if let Some(idx) = queue.ready.iter().position(|id| id == transaction_id) {
                    queue.ready.remove(idx);
                    queue.executed.push_back(transaction_id.clone());
                    e.storage().instance().set(&DataKey::TimelockQueue, &queue);
                }
            }
        }

        e.events().publish(
            (symbol_short!("tx_exec"), transaction_id.clone()),
            transaction.amount,
        );
        Ok(())
    }

    // Propose a batch transaction
    pub fn propose_batch(
        e: Env,
        transactions: Vec<BytesN<32>>,
        proposer: Address,
        nonce: u64,
    ) -> Result<BytesN<32>, MultisigError> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            return Err(MultisigError::ContractPaused);
        }

        let frozen: bool = e.storage().instance().get(&DataKey::Frozen).unwrap_or(false);
        if frozen {
            return Err(MultisigError::WalletFrozen);
        }

        proposer.require_auth();

        // Validate nonce
        Self::validate_nonce(&e, &proposer, nonce)?;

        // Validate proposer is active signer
        Self::validate_signer(&e, &proposer)?;

        // Validate batch size
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).ok_or(MultisigError::NotInitialized)?;
        if transactions.len() > config.max_batch_size {
            return Err(MultisigError::BatchSizeExceeded);
        }

        // Validate all transactions exist and are proposed
        for tx_id in transactions.iter() {
            let tx: Transaction = e.storage().instance().get(&DataKey::Transaction(tx_id.clone()))
                .ok_or(MultisigError::TransactionNotFound)?;
            
            if tx.status != TransactionStatus::Proposed {
                return Err(MultisigError::InvalidTransactionStatus);
            }

            if tx.batch_id.is_some() {
                return Err(MultisigError::TransactionAlreadyInBatch);
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

        e.events().publish(
            (symbol_short!("bat_prop"), batch_id.clone()),
            (transactions.len(), proposer),
        );

        Ok(batch_id)
    }

    // Sign a batch
    pub fn sign_batch(e: Env, batch_id: BytesN<32>, signer: Address) -> Result<(), MultisigError> {
        signer.require_auth();

        let mut batch: Batch = e.storage().instance().get(&DataKey::Batch(batch_id.clone()))
            .ok_or(MultisigError::BatchNotFound)?;

        if batch.status != BatchStatus::Proposed {
            return Err(MultisigError::InvalidBatchStatus);
        }

        if e.ledger().timestamp() > batch.expires_at {
            return Err(MultisigError::BatchExpired);
        }

        // Validate signer
        Self::validate_signer(&e, &signer)?;

        // Check if already signed
        if batch.signatures.contains(&signer) {
            return Err(MultisigError::AlreadySigned);
        }

        // Add signature
        batch.signatures.push_back(signer.clone());

        // Check if batch is approved
        let config: WalletConfig = e.storage().instance().get(&DataKey::WalletConfig).ok_or(MultisigError::NotInitialized)?;
        if Self::has_required_signatures_batch(&e, &batch, config.m) {
            batch.status = BatchStatus::Approved;
            e.events().publish(
                (symbol_short!("bat_app"), batch_id.clone()),
                signer.clone(),
            );
        }

        e.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);
        e.events().publish(
            (symbol_short!("bat_sig"), batch_id.clone()),
            signer,
        );
        Ok(())
    }

    // Execute a batch
    pub fn execute_batch(e: Env, batch_id: BytesN<32>) -> Result<(), MultisigError> {
        let mut batch: Batch = e.storage().instance().get(&DataKey::Batch(batch_id.clone()))
            .ok_or(MultisigError::BatchNotFound)?;

        if batch.status != BatchStatus::Approved {
            return Err(MultisigError::InvalidBatchStatus);
        }

        if e.ledger().timestamp() > batch.expires_at {
            return Err(MultisigError::BatchExpired);
        }

        // Execute all transactions in batch
        for tx_id in batch.transactions.iter() {
            if let Some(mut tx) = e.storage().instance().get::<_, Transaction>(&DataKey::Transaction(tx_id.clone())) {
                if tx.status == TransactionStatus::Approved {
                    let token_client = soroban_sdk::token::Client::new(&e, &tx.token);
                    token_client.transfer(&e.current_contract_address(), &tx.to, &tx.amount);

                    tx.status = TransactionStatus::Executed;
                    e.storage().instance().set(&DataKey::Transaction(tx_id.clone()), &tx);

                    Self::update_daily_spending(&e, &tx);
                }
            }
        }

        batch.status = BatchStatus::Executed;
        e.storage().instance().set(&DataKey::Batch(batch_id.clone()), &batch);

        e.events().publish(
            (symbol_short!("bat_exec"), batch_id.clone()),
            batch.transactions.len(),
        );
        Ok(())
    }

    // Emergency freeze
    pub fn emergency_freeze(e: Env, duration: u64) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        admin.require_auth();

        e.storage().instance().set(&DataKey::Frozen, &true);
        e.storage().instance().set(&symbol_short!("unf_time"), &(e.ledger().timestamp() + duration));

        e.events().publish(
            (symbol_short!("freeze"),),
            duration,
        );
        Ok(())
    }

    // Unfreeze (can be called by admin or after timeout)
    pub fn unfreeze(e: Env) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        let unfreeze_time: Option<u64> = e.storage().instance().get(&symbol_short!("unf_time"));

        let mut is_admin = false;
        if let Ok(_) = admin.require_auth() {
            is_admin = true;
        }
        
        if !is_admin {
            if let Some(time) = unfreeze_time {
                if e.ledger().timestamp() < time {
                    return Err(MultisigError::Unauthorized);
                }
            } else {
                return Err(MultisigError::Unauthorized);
            }
        }

        e.storage().instance().set(&DataKey::Frozen, &false);
        e.storage().instance().remove(&symbol_short!("unf_time"));

        e.events().publish(
            (symbol_short!("unfreeze"),),
            (),
        );
        Ok(())
    }

    // Admin functions
    pub fn pause(e: Env) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(e: Env) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    pub fn update_config(e: Env, new_config: WalletConfig) -> Result<(), MultisigError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(MultisigError::NotInitialized)?;
        admin.require_auth();
        Self::validate_config(&new_config)?;
        e.storage().instance().set(&DataKey::WalletConfig, &new_config);
        Ok(())
    }

    // View functions
    pub fn get_config(e: Env) -> WalletConfig {
        e.storage().instance().get(&DataKey::WalletConfig).unwrap()
    }

    pub fn get_signers(e: Env) -> Vec<Signer> {
        e.storage().persistent().get(&DataKey::Signers).unwrap_or(Vec::new(&e))
    }

    pub fn get_transaction(e: Env, transaction_id: BytesN<32>) -> Result<Transaction, MultisigError> {
        e.storage().instance().get(&DataKey::Transaction(transaction_id))
            .ok_or(MultisigError::TransactionNotFound)
    }

    pub fn get_batch(e: Env, batch_id: BytesN<32>) -> Result<Batch, MultisigError> {
        e.storage().instance().get(&DataKey::Batch(batch_id))
            .ok_or(MultisigError::BatchNotFound)
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
    fn validate_config(config: &WalletConfig) -> Result<(), MultisigError> {
        if config.m == 0 || config.n == 0 {
            return Err(MultisigError::InvalidConfig);
        }

        if config.m > config.n {
            return Err(MultisigError::InvalidConfig);
        }

        if config.daily_spending_limit <= 0 {
            return Err(MultisigError::InvalidAmount);
        }

        Ok(())
    }

    fn add_signer_internal(e: &Env, signer_address: Address, role: Role, weight: u32) -> Result<(), MultisigError> {
        let mut signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or_else(|| Vec::new(e));
        
        if signers.iter().any(|s| s.address == signer_address) {
            return Err(MultisigError::SignerAlreadyExists);
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

        e.events().publish(
            (symbol_short!("sig_add"), signer_address.clone()),
            (),
        );
        Ok(())
    }

    fn validate_signer(e: &Env, signer: &Address) -> Result<(), MultisigError> {
        let signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or_else(|| Vec::new(e));
        
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
        let used_nonce: u64 = e.storage().instance().get(&DataKey::UserNonce(signer.clone())).unwrap_or(0);
        if nonce <= used_nonce {
            return Err(MultisigError::NonceUsed);
        }
        Ok(())
    }

    fn use_nonce(e: &Env, signer: &Address, nonce: u64) {
        e.storage().instance().set(&DataKey::UserNonce(signer.clone()), &nonce);
    }

    fn has_required_signatures(e: &Env, transaction: &Transaction, required: u32) -> bool {
        let signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or_else(|| Vec::new(e));
        let mut total_weight = 0;
        
        for signature in transaction.signatures.iter() {
            if let Some(signer) = signers.iter().find(|s| s.address == signature) {
                if signer.active {
                    total_weight += signer.weight;
                }
            }
        }
        
        total_weight >= required
    }

    fn has_required_signatures_batch(e: &Env, batch: &Batch, required: u32) -> bool {
        let signers: Vec<Signer> = e.storage().persistent().get(&DataKey::Signers).unwrap_or_else(|| Vec::new(e));
        let mut total_weight = 0;
        
        for signature in batch.signatures.iter() {
            if let Some(signer) = signers.iter().find(|s| s.address == signature) {
                if signer.active {
                    total_weight += signer.weight;
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
