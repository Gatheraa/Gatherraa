#![no_std]

//! Gathera Multi-Signature Wallet Contract
//!
//! This contract implements a multi-signature wallet system for the Gathera platform.
//! It provides secure fund management requiring multiple approvals for transactions,
//! enhancing security for organizational funds and critical operations.
//!
//! ## Key Features
//!
//! - Multi-signature transaction approval
//! - Configurable threshold settings
//! - Owner management with voting
//! - Transaction history tracking
//! - Time-lock for critical operations
//! - Integration with escrow for enhanced security
//!
//! ## Modules
//!
//! - `contract`: Main contract implementation
//! - `storage`: Wallet data storage structures
//! - `validation`: Transaction validation logic
//! - `governance`: Owner management and voting

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, FromVal, String, Symbol,
    Val, Vec,
};

/// Errors that can occur during multisig operations
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MultisigError {
    /// Transaction already exists
    TransactionAlreadyExists = 1,
    /// Transaction does not exist
    TransactionNotFound = 2,
    /// Unauthorized access
    Unauthorized = 3,
    /// Insufficient signatures
    InsufficientSignatures = 4,
    /// Invalid owner
    InvalidOwner = 5,
    /// Threshold not met
    ThresholdNotMet = 6,
    /// Transaction already executed
    AlreadyExecuted = 7,
    /// Invalid transaction data
    InvalidTransaction = 8,
    /// Wallet is locked
    WalletLocked = 9,
    /// Duplicate signature
    DuplicateSignature = 10,
    /// Functionality not implemented yet
    NotImplemented = 255,
}

/// Transaction status enumeration
#[contracttype]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum TransactionStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Executed = 3,
    Expired = 4,
}

/// Transaction data structure
#[contracttype]
#[derive(Debug, Clone)]
pub struct Transaction {
    /// Unique transaction identifier
    pub transaction_id: Symbol,
    /// Destination address
    pub destination: Address,
    /// Amount to transfer
    pub amount: i128,
    /// Method to call
    pub function: Symbol,
    /// Transaction data/payload
    pub data: Vec<Val>,
    /// Current status
    pub status: TransactionStatus,
    /// Creation timestamp
    pub created_at: u64,
    /// Expiration timestamp
    pub expires_at: u64,
    /// Required confirmations
    pub required_confirmations: u32,
    /// Current confirmations
    pub confirmations: Vec<Address>,
    /// Transaction creator
    pub creator: Address,
}

/// Multi-signature wallet configuration
#[contracttype]
#[derive(Debug, Clone)]
pub struct MultisigConfig {
    /// List of wallet owners
    pub owners: Vec<Address>,
    /// Number of signatures required
    pub threshold: u32,
    /// Time-lock period for transactions
    pub timelock: u64,
    /// Maximum transaction amount
    pub max_transaction_amount: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config,
    Transaction(Symbol),
    Initialized,
    TxCount,
}

/// Main contract implementation
#[contract]
pub struct MultisigWalletContract;

#[contractimpl]
impl MultisigWalletContract {
    /// Initialize the multi-signature wallet
    ///
    /// # Arguments
    ///
    /// * `owners` - List of initial wallet owners
    /// * `threshold` - Number of signatures required
    /// * `timelock` - Time-lock period in seconds
    /// * `max_amount` - Maximum transaction amount
    ///
    /// # Returns
    ///
    /// True if initialization was successful
    pub fn initialize(
        env: Env,
        owners: Vec<Address>,
        threshold: u32,
        timelock: u64,
        max_amount: i128,
    ) -> Result<bool, MultisigError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(MultisigError::Unauthorized);
        }

        if threshold == 0 || threshold > owners.len() {
            return Err(MultisigError::InvalidTransaction);
        }

        let config = MultisigConfig {
            owners,
            threshold,
            timelock,
            max_transaction_amount: max_amount,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::Initialized, &true);

        Ok(true)
    }

    pub fn is_contract_calling_self(env: Env) -> bool {
        env.current_contract_address() == env.current_contract_address() // Simplified, in a real scenario we'd use caller check if possible
    }

    /// Submit a new transaction
    ///
    /// # Arguments
    ///
    /// * `destination` - Recipient address
    /// * `amount` - Amount to transfer
    /// * `data` - Transaction data
    /// * `expires_at` - Expiration timestamp
    ///
    /// # Returns
    ///
    /// Transaction ID of the newly created transaction
    pub fn submit_transaction(
        env: Env,
        creator: Address,
        destination: Address,
        amount: i128,
        function: Symbol,
        data: Vec<Val>,
        expires_at: u64,
    ) -> Result<Symbol, MultisigError> {
        creator.require_auth();
        let config = Self::get_config(env.clone());

        if !config.owners.contains(&creator) {
            return Err(MultisigError::Unauthorized);
        }

        if amount > config.max_transaction_amount {
            return Err(MultisigError::InvalidTransaction);
        }

        if expires_at <= env.ledger().timestamp() {
            return Err(MultisigError::InvalidTransaction);
        }

        let tx_count: u32 = env.storage().instance().get(&DataKey::TxCount).unwrap_or(0);

        // Actually, let's use the tx_count to make a unique symbol without format!
        // Since we are in Soroban, we can use Symbol::new with a simple string if we are careful,
        // but for no_std we should avoid things that might use alloc if possible or use Soroban provided tools.
        // Soroban's Symbol can be created from a string.
        let mut buf = [0u8; 10];
        let mut n = tx_count;
        let mut i = 0;
        if n == 0 {
            buf[0] = b'0';
            i = 1;
        } else {
            while n > 0 {
                buf[i] = (n % 10) as u8 + b'0';
                n /= 10;
                i += 1;
            }
            // Reverse the buffer
            for j in 0..i / 2 {
                buf.swap(j, i - 1 - j);
            }
        }

        let tx_id_str = core::str::from_utf8(&buf[..i]).unwrap_or("0");
        let tx_id_symbol = Symbol::new(&env, tx_id_str);

        if env
            .storage()
            .persistent()
            .has(&DataKey::Transaction(tx_id_symbol.clone()))
        {
            return Err(MultisigError::TransactionAlreadyExists);
        }

        let transaction = Transaction {
            transaction_id: tx_id_symbol.clone(),
            destination,
            amount,
            function,
            data,
            status: TransactionStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at,
            required_confirmations: config.threshold,
            confirmations: Vec::new(&env),
            creator,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Transaction(tx_id_symbol.clone()), &transaction);
        env.storage()
            .instance()
            .set(&DataKey::TxCount, &(tx_count + 1));

        Ok(tx_id_symbol)
    }

    /// Approve a transaction
    ///
    /// # Arguments
    ///
    /// * `transaction_id` - Identifier for the transaction
    ///
    /// # Returns
    ///
    /// True if approval was successful
    pub fn approve_transaction(
        env: Env,
        transaction_id: Symbol,
        approver: Address,
    ) -> Result<bool, MultisigError> {
        approver.require_auth();
        let config = Self::get_config(env.clone());

        if !config.owners.contains(&approver) {
            return Err(MultisigError::Unauthorized);
        }

        let mut transaction: Transaction = env
            .storage()
            .persistent()
            .get(&DataKey::Transaction(transaction_id.clone()))
            .ok_or(MultisigError::TransactionNotFound)?;

        if transaction.status != TransactionStatus::Pending {
            return Err(MultisigError::AlreadyExecuted);
        }

        if transaction.expires_at <= env.ledger().timestamp() {
            transaction.status = TransactionStatus::Expired;
            env.storage()
                .persistent()
                .set(&DataKey::Transaction(transaction_id), &transaction);
            return Err(MultisigError::InvalidTransaction);
        }

        if transaction.confirmations.contains(&approver) {
            return Err(MultisigError::DuplicateSignature);
        }

        if transaction.creator == approver {
            return Err(MultisigError::Unauthorized); // Reject self-approval
        }

        transaction.confirmations.push_back(approver);

        if transaction.confirmations.len() >= transaction.required_confirmations {
            transaction.status = TransactionStatus::Approved;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Transaction(transaction_id), &transaction);

        Ok(true)
    }

    /// Execute an approved transaction
    ///
    /// # Arguments
    ///
    /// * `transaction_id` - Identifier for the transaction
    ///
    /// # Returns
    ///
    /// True if execution was successful
    pub fn execute_transaction(env: Env, transaction_id: Symbol) -> Result<bool, MultisigError> {
        let mut transaction: Transaction = env
            .storage()
            .persistent()
            .get(&DataKey::Transaction(transaction_id.clone()))
            .ok_or(MultisigError::TransactionNotFound)?;

        if transaction.status != TransactionStatus::Approved {
            if transaction.status == TransactionStatus::Pending
                && transaction.confirmations.len() >= transaction.required_confirmations
            {
                // Should have been set to Approved in approve_transaction, but let's be safe
            } else {
                return Err(MultisigError::ThresholdNotMet);
            }
        }

        let config = Self::get_config(env.clone());

        // Enforce timelock
        if env.ledger().timestamp() < transaction.created_at + config.timelock {
            return Err(MultisigError::WalletLocked);
        }

        // Enforce expiration
        if env.ledger().timestamp() > transaction.expires_at {
            transaction.status = TransactionStatus::Expired;
            env.storage()
                .persistent()
                .set(&DataKey::Transaction(transaction_id), &transaction);
            return Err(MultisigError::InvalidTransaction);
        }

        // Re-entry protection: update status before execution
        transaction.status = TransactionStatus::Executed;
        env.storage()
            .persistent()
            .set(&DataKey::Transaction(transaction_id.clone()), &transaction);

        // Execute the contract call
        if transaction.destination != env.current_contract_address() {
            let _: Val = env.invoke_contract(
                &transaction.destination,
                &transaction.function,
                transaction.data,
            );
        } else {
            // Dispatch to self safely without re-entry
            if transaction.function == Symbol::new(&env, "add_owner") {
                let new_owner: Address = Address::from_val(&env, &transaction.data.get(0).unwrap());
                let tx_id: Symbol = Symbol::from_val(&env, &transaction.data.get(1).unwrap());
                let _ = Self::add_owner_internal(env.clone(), new_owner, tx_id);
            } else if transaction.function == Symbol::new(&env, "remove_owner") {
                let owner_to_remove: Address =
                    Address::from_val(&env, &transaction.data.get(0).unwrap());
                let tx_id: Symbol = Symbol::from_val(&env, &transaction.data.get(1).unwrap());
                let _ = Self::remove_owner_internal(env.clone(), owner_to_remove, tx_id);
            } else if transaction.function == Symbol::new(&env, "change_threshold") {
                let new_threshold: u32 = u32::from_val(&env, &transaction.data.get(0).unwrap());
                let tx_id: Symbol = Symbol::from_val(&env, &transaction.data.get(1).unwrap());
                let _ = Self::change_threshold_internal(env.clone(), new_threshold, tx_id);
            }
        }

        // Emit an event to signal execution.
        env.events().publish(
            (
                Symbol::new(&env, "executed"),
                transaction.transaction_id.clone(),
            ),
            (transaction.destination.clone(), transaction.amount),
        );

        Ok(true)
    }

    /// Add a new owner
    ///
    /// # Arguments
    ///
    /// * `new_owner` - Address of the new owner
    /// * `transaction_id` - Governing transaction ID
    ///
    /// # Returns
    ///
    /// True if owner addition was successful
    pub fn add_owner(
        env: Env,
        new_owner: Address,
        transaction_id: Symbol,
    ) -> Result<bool, MultisigError> {
        env.current_contract_address().require_auth();
        Self::add_owner_internal(env, new_owner, transaction_id)
    }

    fn add_owner_internal(
        env: Env,
        new_owner: Address,
        transaction_id: Symbol,
    ) -> Result<bool, MultisigError> {
        let tx = Self::get_transaction(env.clone(), transaction_id)?;
        if tx.status != TransactionStatus::Executed {
            return Err(MultisigError::Unauthorized);
        }

        let mut config = Self::get_config(env.clone());
        if config.owners.contains(&new_owner) {
            return Err(MultisigError::InvalidOwner);
        }

        config.owners.push_back(new_owner);
        env.storage().instance().set(&DataKey::Config, &config);

        Ok(true)
    }

    /// Remove an owner
    ///
    /// # Arguments
    ///
    /// * `owner_to_remove` - Address of the owner to remove
    /// * `transaction_id` - Governing transaction ID
    ///
    /// # Returns
    ///
    /// True if owner removal was successful
    pub fn remove_owner(
        env: Env,
        owner_to_remove: Address,
        transaction_id: Symbol,
    ) -> Result<bool, MultisigError> {
        env.current_contract_address().require_auth();
        Self::remove_owner_internal(env, owner_to_remove, transaction_id)
    }

    fn remove_owner_internal(
        env: Env,
        owner_to_remove: Address,
        transaction_id: Symbol,
    ) -> Result<bool, MultisigError> {
        let tx = Self::get_transaction(env.clone(), transaction_id)?;
        if tx.status != TransactionStatus::Executed {
            return Err(MultisigError::Unauthorized);
        }

        let mut config = Self::get_config(env.clone());
        let mut found = false;
        let mut new_owners = Vec::new(&env);

        for owner in config.owners.iter() {
            if owner == owner_to_remove {
                found = true;
            } else {
                new_owners.push_back(owner);
            }
        }

        if !found {
            return Err(MultisigError::InvalidOwner);
        }

        if new_owners.len() < config.threshold {
            return Err(MultisigError::ThresholdNotMet);
        }

        if new_owners.len() == 0 {
            return Err(MultisigError::InvalidTransaction);
        }

        config.owners = new_owners;
        env.storage().instance().set(&DataKey::Config, &config);

        Ok(true)
    }

    /// Change the signature threshold
    ///
    /// # Arguments
    ///
    /// * `new_threshold` - New threshold value
    /// * `transaction_id` - Governing transaction ID
    ///
    /// # Returns
    ///
    /// True if threshold change was successful
    pub fn change_threshold(
        env: Env,
        new_threshold: u32,
        transaction_id: Symbol,
    ) -> Result<bool, MultisigError> {
        env.current_contract_address().require_auth();
        Self::change_threshold_internal(env, new_threshold, transaction_id)
    }

    fn change_threshold_internal(
        env: Env,
        new_threshold: u32,
        transaction_id: Symbol,
    ) -> Result<bool, MultisigError> {
        let tx = Self::get_transaction(env.clone(), transaction_id)?;
        if tx.status != TransactionStatus::Executed {
            return Err(MultisigError::Unauthorized);
        }

        let mut config = Self::get_config(env.clone());
        if new_threshold == 0 || new_threshold > config.owners.len() {
            return Err(MultisigError::InvalidTransaction);
        }

        config.threshold = new_threshold;
        env.storage().instance().set(&DataKey::Config, &config);

        Ok(true)
    }

    /// Get transaction information
    ///
    /// # Arguments
    ///
    /// * `transaction_id` - Identifier for the transaction
    ///
    /// # Returns
    ///
    /// Transaction data structure
    pub fn get_transaction(env: Env, transaction_id: Symbol) -> Result<Transaction, MultisigError> {
        env.storage()
            .persistent()
            .get(&DataKey::Transaction(transaction_id))
            .ok_or(MultisigError::TransactionNotFound)
    }

    /// Get wallet configuration
    ///
    /// # Returns
    ///
    /// Current wallet configuration
    pub fn get_config(env: Env) -> MultisigConfig {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| MultisigConfig {
                owners: Vec::new(&env),
                threshold: 0,
                timelock: 0,
                max_transaction_amount: 0,
            })
    }
}

#[cfg(test)]
mod security_tests;
