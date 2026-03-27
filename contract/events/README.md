# Events Module

## Overview
The events module handles all event-related functionality including ticketing, subscriptions, and event creation utilities.

## Submodules

### ticket
Event ticketing contracts for creating, managing, and validating event tickets.

**Features:**
- Ticket creation and management
- Seat allocation
- Transfer controls
- Attendance verification

### subscription
Subscription management contracts for recurring event access and membership models.

**Features:**
- Recurring payment processing
- Subscription tier management
- Automatic renewals
- Usage tracking

### event_factory
Event creation utilities for deploying and managing event-related contracts.

**Features:**
- Contract deployment automation
- Event template management
- Configuration utilities
- Integration helpers

## Dependencies
- `gathera-common`: Shared types and utilities
- `gathera-financial`: Payment processing
- `gathera-identity`: User verification

## Usage
Events modules provide the complete infrastructure for event management, from creation to ticket sales and subscription services.
