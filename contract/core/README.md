# Core Module

## Overview
The core module provides fundamental infrastructure and utilities for all Gatheraa contracts.

## Submodules

### access_control
Provides role-based access control (RBAC) functionality for contract administration.

**Features:**
- Role assignment and management
- Permission-based access control
- Admin and moderator roles
- Secure authorization checks

### storage
Offers optimized storage patterns and utilities for efficient data management.

**Features:**
- Storage key management
- Data serialization helpers
- Storage optimization patterns
- Cache management utilities

### upgrade
Handles contract upgrade functionality with safety checks and versioning.

**Features:**
- Secure upgrade mechanisms
- Version tracking
- Migration utilities
- Rollback capabilities

## Dependencies
- `gathera-common`: Shared types and utilities
- `soroban-sdk`: Stellar Soroban SDK

## Usage
Core modules are used as foundational components across all other contract modules, providing consistent patterns for access control, storage management, and upgradeability.
