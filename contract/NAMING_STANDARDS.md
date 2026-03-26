# Gatherraa Smart Contract Naming Standards

To maintain a clean and professional codebase, all smart contracts in the Gatherraa ecosystem must adhere to the following naming conventions.

## 1. General Principles
- Use **descriptive** names over short, cryptic ones (e.g., `environment` instead of `e`).
- Prefer **clarity** over brevity.
- Follow standard Rust naming conventions (RFC 430).

## 2. Naming Conventions

| Item | Convention | Example |
| :--- | :--- | :--- |
| **Crates** | `snake_case` | `gathera-common`, `escrow-contract` |
| **Modules** | `snake_case` | `mod storage_types;`, `mod access;` |
| **Types (Structs, Enums)** | `PascalCase` | `struct AuctionConfig`, `enum DataKey` |
| **Functions** | `snake_case` | `pub fn initialize_contract()`, `fn calculate_reward()` |
| **Variables (Local/Param)** | `snake_case` | `let total_amount = 0;`, `pub fn stake(env: Env, user: Address)` |
| **Constants** | `SCREAMING_SNAKE_CASE` | `const MAX_BATCH_SIZE: u32 = 100;` |
| **Statics** | `SCREAMING_SNAKE_CASE` | `static VERSION: u32 = 1;` |
| **Traits** | `PascalCase` | `trait AdminActions` |
| **Type Parameters** | `CapitalSingleLetter` | `fn generic_func<T>(obj: T)` |

## 3. Specific Soroban Patterns

### Environment
Always use `env` for the `soroban_sdk::Env` parameter in function signatures.
- **Good**: `pub fn initialize(env: Env, admin: Address)`
- **Bad**: `pub fn initialize(e: Env, admin: Address)`

### Storage Keys
DataKey enum variants should be `PascalCase` and descriptive of the data they point to.
- **Good**: `DataKey::Admin`, `DataKey::UserBalance(Address)`
- **Bad**: `DataKey::A`, `DataKey::Balance(Address)`

### Error Enums
Contract errors should end with `Error` and be descriptive.
- **Good**: `DutchAuctionError::AuctionNotFound`
- **Bad**: `DutchAuctionError::Error4`

## 4. Linting
All crates should include the following at the top of their `lib.rs`:
```rust
#![deny(clippy::all)]
#![deny(clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]
```
This ensures the compiler enforces naming and code quality standards during build.
