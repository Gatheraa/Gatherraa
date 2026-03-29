# Contract Interactions and Data Flow

This document describes how different Gathera contracts interact with each other and how data flows through the system.

## 1. Ticketing Workflow

The following diagram illustrates the flow from creating an event to minting and verifying soulful tickets.

```mermaid
sequenceDiagram
    participant Organizer as Event Organizer
    participant Ticket as Ticket Contract
    participant Escrow as Escrow Contract
    participant Attendee as Attendee

    Organizer->>Ticket: create_event(metadata)
    Ticket-->>Organizer: event_id
    Attendee->>Escrow: deposit_funds(event_id, amount)
    Escrow->>Ticket: notify_deposit(event_id, attendee_id)
    Ticket->>Ticket: mint_soulbound_ticket(attendee_id)
    Attendee->>Ticket: verify_ticket(ticket_id)
    Ticket-->>Attendee: valid/invalid
```

## 2. Dutch Auction for Premium Tickets

The following diagram describes the pricing and purchase flow during a Dutch auction.

```mermaid
graph TD
    A[Start Auction] --> B{Check Time}
    B -- Duration Not Met --> C[Calculate Current Price]
    C --> D[Bidding]
    D --> E{Bid > Current Price?}
    E -- Yes --> F[Accept Bid & Mint Ticket]
    E -- No --> G[Reject Bid]
    B -- Duration Met --> H[End Auction]
```

## 3. Multisig Engagement

Organizations use the multisig wallet for critical operations like releasing large escrow balances.

```mermaid
sequenceDiagram
    participant Proposer as Proposal Creator
    participant Multisig as Multisig Contract
    participant Escrow as Escrow Contract
    participant Owners as Owners (A, B, C)

    Proposer->>Multisig: submit_proposal(exec: release_escrow)
    Multisig->>Multisig: log_proposal(prop_id)
    Owners->>Multisig: approve_proposal(prop_id)
    Multisig->>Multisig: check_threshold()
    Multisig->>Escrow: release_funds(amount)
    Escrow-->>Multisig: success/failure
```

## 4. Security Considerations

- **Reentrancy**: All contracts follow the checks-effects-interactions pattern to prevent reentrancy.
- **Access Control**: Roles are strictly verified on every sensitive function call.
- **Gas Limit Protection**: Transactions are batched to avoid hitting the Soroban 5MB WASM limit and CPU constraints.
- **Data Integrity**: Critical states (e.g., ticket ownership) use `Persistent` storage to ensure permanence.
