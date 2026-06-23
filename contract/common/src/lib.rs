//! Gathera common utilities
//! Minimal stub — full implementation pending Soroban SDK migration

use soroban_sdk::{Address, Bytes, Env, String, Symbol};

/// Common status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum CommonStatus {
    Inactive = 0,
    Active = 1,
    Suspended = 2,
    Completed = 3,
    Cancelled = 4,
}

/// Sort direction enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum SortDirection {
    Ascending = 0,
    Descending = 1,
}

/// Common error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommonError {
    InvalidInput,
    Unauthorized,
    NotFound,
    AlreadyExists,
    InternalError,
    RateLimited,
    Maintenance,
}

/// Common result type for contract operations
pub type ContractResult<T> = Result<T, CommonError>;

/// Validation utilities — stub
pub struct ValidationUtils;
impl ValidationUtils {
    pub fn validate_address(address: &Address) -> bool {
        Self::validate_generic_address(&address.to_string())
    }

    pub fn validate_evm_address(env: &Env, address: &String) -> bool {
        let bytes = address.to_bytes();
        if bytes.len() != 42 || bytes.get(0) != Some(b'0') || bytes.get(1) != Some(b'x') {
            return false;
        }

        let mut lowercase = Bytes::new(env);
        let mut non_zero = false;
        for i in 2..42 {
            let Some(byte) = bytes.get(i) else {
                return false;
            };
            let Some(lower) = Self::to_lower_hex(byte) else {
                return false;
            };
            if lower != b'0' {
                non_zero = true;
            }
            lowercase.push_back(lower);
        }

        if !non_zero {
            return false;
        }

        let hash = env.crypto().keccak256(&lowercase).to_array();
        for i in 0..40 {
            let byte = bytes.get(i + 2).unwrap();
            if Self::is_hex_alpha(byte) {
                let hash_byte = hash[(i / 2) as usize];
                let nibble = if i % 2 == 0 {
                    (hash_byte >> 4) & 0x0f
                } else {
                    hash_byte & 0x0f
                };
                let expected_uppercase = nibble >= 8;
                if expected_uppercase != Self::is_upper_hex(byte) {
                    return false;
                }
            }
        }

        true
    }

    pub fn validate_stellar_address(address: &String) -> bool {
        let bytes = address.to_bytes();
        if bytes.len() != 56 || bytes.get(0) != Some(b'G') {
            return false;
        }

        if Self::is_zero_stellar_account(&bytes) {
            return false;
        }

        for i in 0..56 {
            let Some(byte) = bytes.get(i) else {
                return false;
            };
            if !Self::is_stellar_base32(byte) {
                return false;
            }
        }

        true
    }

    pub fn validate_generic_address(address: &String) -> bool {
        let bytes = address.to_bytes();
        if bytes.is_empty()
            || Self::is_zero_evm_address(&bytes)
            || Self::is_zero_stellar_account(&bytes)
        {
            return false;
        }

        for byte in bytes.iter() {
            if byte > 0x7f {
                return false;
            }
        }

        true
    }

    pub fn validate_symbol(symbol: &Symbol) -> bool {
        let s = symbol.to_string();
        !s.is_empty() && s.len() <= 32
    }

    fn to_lower_hex(byte: u8) -> Option<u8> {
        match byte {
            b'0'..=b'9' => Some(byte),
            b'a'..=b'f' => Some(byte),
            b'A'..=b'F' => Some(byte + 32),
            _ => None,
        }
    }

    fn is_hex_alpha(byte: u8) -> bool {
        matches!(byte, b'a'..=b'f' | b'A'..=b'F')
    }

    fn is_upper_hex(byte: u8) -> bool {
        matches!(byte, b'A'..=b'F')
    }

    fn is_stellar_base32(byte: u8) -> bool {
        matches!(byte, b'A'..=b'Z' | b'2'..=b'7')
    }

    fn is_zero_evm_address(bytes: &Bytes) -> bool {
        if bytes.len() != 42 || bytes.get(0) != Some(b'0') || bytes.get(1) != Some(b'x') {
            return false;
        }

        for i in 2..42 {
            if bytes.get(i) != Some(b'0') {
                return false;
            }
        }

        true
    }

    fn is_zero_stellar_account(bytes: &Bytes) -> bool {
        let zero = Bytes::from_array(
            bytes.env(),
            b"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        );
        bytes == &zero
    }
}

/// String utilities — stub
pub struct StringUtils;
impl StringUtils {
    pub fn is_alphanumeric(string: &String) -> bool {
        string.to_string().chars().all(|c| c.is_alphanumeric())
    }
}

/// Map utilities — stub
pub struct MapUtils;

/// Time utilities — stub
pub struct TimeUtils;
impl TimeUtils {
    pub fn now(env: &Env) -> u64 { env.ledger().timestamp() }
    pub fn is_past(timestamp: u64, current_time: u64) -> bool { timestamp < current_time }
}

/// Status utilities — stub
pub struct StatusUtils;
impl StatusUtils {
    pub fn is_active(status: CommonStatus) -> bool { status == CommonStatus::Active }
    pub fn is_terminal(status: CommonStatus) -> bool {
        matches!(status, CommonStatus::Completed | CommonStatus::Cancelled)
    }
}

/// Gas testing — disabled
pub mod gas_testing {
    #[derive(Debug, Clone)]
    pub struct GasTestFramework;
    impl GasTestFramework {
        pub fn new(_env: &soroban_sdk::Env) -> Self { Self }
    }
}

/// Errors module — stub
pub mod errors {
    pub mod error_codes {
        pub const INVALID_INPUT: u32 = 1000;
        pub const UNAUTHORIZED: u32 = 1001;
        pub const NOT_FOUND: u32 = 1002;
    }
}

#[cfg(test)]
mod tests {
    use super::ValidationUtils;
    use soroban_sdk::{Env, String};

    fn sdk_string(env: &Env, value: &str) -> String {
        String::from_str(env, value)
    }

    #[test]
    fn evm_validation_accepts_eip55_checksum() {
        let env = Env::default();
        let address = sdk_string(&env, "0x52908400098527886E0F7030069857D2E4169EE7");

        assert!(ValidationUtils::validate_evm_address(&env, &address));
    }

    #[test]
    fn evm_validation_rejects_zero_oversized_unicode_and_bad_checksum() {
        let env = Env::default();
        let zero = sdk_string(&env, "0x0000000000000000000000000000000000000000");
        let oversized = sdk_string(&env, "0x52908400098527886E0F7030069857D2E4169EE70");
        let unicode = sdk_string(&env, "0x52908400098527886E0F7030069857D2E4169EE\u{96ea}");
        let bad_checksum = sdk_string(&env, "0x52908400098527886e0F7030069857D2E4169EE7");

        assert!(!ValidationUtils::validate_evm_address(&env, &zero));
        assert!(!ValidationUtils::validate_evm_address(&env, &oversized));
        assert!(!ValidationUtils::validate_evm_address(&env, &unicode));
        assert!(!ValidationUtils::validate_evm_address(&env, &bad_checksum));
    }

    #[test]
    fn stellar_validation_enforces_prefix_length_and_ascii_base32() {
        let env = Env::default();
        let valid = sdk_string(
            &env,
            "GBZXN7PIRZGNMHGAFAH4K2BC5VJSENLOK5LTMSAJCNAP2FXYIC44AGIL",
        );
        let wrong_prefix = sdk_string(
            &env,
            "CBZXN7PIRZGNMHGAFAH4K2BC5VJSENLOK5LTMSAJCNAP2FXYIC44AGIL",
        );
        let short = sdk_string(
            &env,
            "GBZXN7PIRZGNMHGAFAH4K2BC5VJSENLOK5LTMSAJCNAP2FXYIC44AGI",
        );
        let unicode = sdk_string(
            &env,
            "GBZXN7PIRZGNMHGAFAH4K2BC5VJSENLOK5LTMSAJCNAP2FXYIC44\u{96ea}",
        );

        assert!(ValidationUtils::validate_stellar_address(&valid));
        assert!(!ValidationUtils::validate_stellar_address(&wrong_prefix));
        assert!(!ValidationUtils::validate_stellar_address(&short));
        assert!(!ValidationUtils::validate_stellar_address(&unicode));
    }

    #[test]
    fn generic_validation_rejects_known_zero_addresses() {
        let env = Env::default();
        let evm_zero = sdk_string(&env, "0x0000000000000000000000000000000000000000");
        let stellar_zero = sdk_string(
            &env,
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        );
        let normal = sdk_string(&env, "external-address-1");

        assert!(!ValidationUtils::validate_generic_address(&evm_zero));
        assert!(!ValidationUtils::validate_generic_address(&stellar_zero));
        assert!(ValidationUtils::validate_generic_address(&normal));
    }
}
