#!/usr/bin/env node

/**
 * Build script for Soroban contracts
 * This script compiles all Rust contracts and places the WASM files
 * in the appropriate location for integration tests
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTRACTS_DIR = join(__dirname, '../contracts');
const RUST_CONTRACTS_DIR = join(__dirname, '../../contract');
const BUILD_DIR = join(CONTRACTS_DIR, 'build');

console.log('🔨 Building Soroban contracts...');

// Ensure build directory exists
if (!existsSync(BUILD_DIR)) {
  mkdirSync(BUILD_DIR, { recursive: true });
}

try {
  // Change to contract directory and build all contracts
  process.chdir(RUST_CONTRACTS_DIR);
  
  console.log('📦 Building workspace...');
  execSync('cargo build --workspace --target wasm32-unknown-unknown --release', { 
    stdio: 'inherit',
    cwd: RUST_CONTRACTS_DIR
  });
  
  // Copy built WASM files to integration test directory
  const contracts = [
    'gathera-common',
    'ticket_contract', 
    'escrow_contract',
    'multisig_wallet_contract',
    'contracts',
    'gathera-test'
  ];
  
  contracts.forEach(contract => {
    const sourceWasm = join(RUST_CONTRACTS_DIR, 'target', 'wasm32-unknown-unknown', 'release', `${contract}.wasm`);
    const destWasm = join(BUILD_DIR, `${contract}.wasm`);
    
    if (existsSync(sourceWasm)) {
      copyFileSync(sourceWasm, destWasm);
      console.log(`✅ Copied ${contract}.wasm`);
    } else {
      console.log(`⚠️  Warning: ${contract}.wasm not found`);
    }
  });
  
  console.log('✅ Contract build completed successfully!');
  
} catch (error) {
  console.error('❌ Contract build failed:', error.message);
  process.exit(1);
}
