#!/usr/bin/env node

/**
 * Clean script for Soroban contracts
 * This script removes build artifacts
 */

import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const CONTRACTS_DIR = join(__dirname, '../contracts');
const BUILD_DIR = join(CONTRACTS_DIR, 'build');
const RUST_CONTRACTS_DIR = join(__dirname, '../../contract');
const RUST_TARGET_DIR = join(RUST_CONTRACTS_DIR, 'target');

console.log('🧹 Cleaning Soroban contracts...');

// Clean integration test build directory
if (existsSync(BUILD_DIR)) {
  rmSync(BUILD_DIR, { recursive: true, force: true });
  console.log('✅ Cleaned integration test build directory');
}

// Clean Rust target directory
if (existsSync(RUST_TARGET_DIR)) {
  rmSync(RUST_TARGET_DIR, { recursive: true, force: true });
  console.log('✅ Cleaned Rust target directory');
}

console.log('✅ Contract cleanup completed!');
