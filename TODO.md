# TODO - Escrow contract Soroban macro/type fixes & wasm build

## Step 1: Verify escrow contract macro/type annotations
- [x] Add `#[contract]` to `EscrowContract`
- [x] Add `#[contracttype]` to `EscrowStatus`, `Escrow`, `Dispute`
- [x] Ensure `#[contracterror]` on `EscrowError` is already present with stable codes

## Step 2: Fix workspace wasm build blockers
- [ ] Restore `#![no_std]` at absolute top of `contract/common/src/lib.rs`
- [ ] Ensure `soroban-sdk` in workspace root Cargo.toml uses `default-features = false` (already present)
- [ ] Re-run cache invalidation sequence:
  - [ ] `cargo clean` (from `contract/` workspace)
  - [ ] `cargo check -p gathera-common --target wasm32-unknown-unknown --message-format short`
  - [ ] `cargo check -p escrow_contract --target wasm32-unknown-unknown --message-format short`
  - [ ] `cargo build -p escrow_contract --target wasm32-unknown-unknown --release`

## Step 3: Confirm acceptance criteria
- [ ] `cargo check --target wasm32-unknown-unknown` exits 0
- [ ] wasm artifact exists for `escrow_contract`

