# Contract Verification Guide

This document outlines the workflow for verifying Gathera smart contracts on the Soroban network.

## Automatic Verification (CI/CD)

The CI/CD pipeline automatically verifies contract integrity on every push to the `main` branch. 

1. **Hash Verification**: The pipeline computes the SHA-256 hash of all compiled WASM binaries and compares them against known baselines.
2. **Report Generation**: A verification report is generated in `docs/CONTRACT_VERIFICATION.md` as part of the pipeline.
3. **Artifact Upload**: Deployed contract addresses and their respective WASM hashes are uploaded as build artifacts.

## Manual Verification

To manually verify contract hashes:

1. Build the contracts:
   ```bash
   cd contract
   cargo build --target wasm32-unknown-unknown --release
   ```

2. Run the verification script:
   ```bash
   bash scripts/verify_contracts.sh
   ```

3. Review the generated report at `docs/CONTRACT_VERIFICATION.md`.

## On-Chain Verification

To verify that a deployed contract matches the local source code:

1. Get the local WASM hash:
   ```bash
   sha256sum contract/target/wasm32-unknown-unknown/release/ticket_contract.wasm
   ```

2. Get the on-chain WASM hash for the contract ID:
   ```bash
   soroban contract read-code --id <CONTRACT_ID> --network <NETWORK> | sha256sum
   ```

3. Compare the hashes. They must match exactly.
