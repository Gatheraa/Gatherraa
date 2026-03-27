#!/bin/bash

# Identity Contract Deployment Script

set -e

echo "Building Identity Contract..."
cd "$(dirname "$0")"

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Contract built successfully"
    
    # Get the WASM file path
    WASM_FILE="target/wasm32-unknown-unknown/release/identity_contract.wasm"
    
    if [ -f "$WASM_FILE" ]; then
        echo "Contract WASM file: $WASM_FILE"
        echo "File size: $(du -h $WASM_FILE | cut -f1)"
        
        echo ""
        echo "To deploy this contract:"
        echo "1. Use soroban-cli to deploy the WASM file"
        echo "2. Initialize the contract with an admin address"
        echo ""
        echo "Example deployment command:"
        echo "soroban contract deploy \\"
        echo "  --wasm $WASM_FILE \\"
        echo "  --source <YOUR_ACCOUNT> \\"
        echo "  --network <NETWORK>"
        echo ""
        echo "Example initialization:"
        echo "soroban contract invoke \\"
        echo "  --id <CONTRACT_ID> \\"
        echo "  --source <YOUR_ACCOUNT> \\"
        echo "  --network <NETWORK> \\"
        echo "  -- initialize \\"
        echo "  --admin <ADMIN_ADDRESS>"
    else
        echo "❌ WASM file not found at $WASM_FILE"
        exit 1
    fi
else
    echo "❌ Build failed"
    exit 1
fi