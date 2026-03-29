# ADR-003: Access Control Model

- **Status**: Accepted
- **Created**: March 29, 2026
- **Context**: The Gathera contract suite should only allow authorized users to perform certain operations (e.g., minting tickets, releasing escrow funds).
- **Decision**: We have decided to implement a Role-Based Access Control (RBAC) system in the `common` module, which will be shared across all contracts:
  1.  **Admin**: Can update contract configuration and add/remove Owners.
  2.  **Owner**: Multiple owners can be defined for a single instance.
  3.  **Operator**: Can perform day-to-day operations like starting an auction or verifying tickets.
  4.  **Attendee**: Standard users with restricted permissions.
- **Consequences**:
  - **Security**: Granular controls prevent unauthorized actions.
  - **Shared Logic**: Centralizing RBAC in `common` ensures consistency across all modules.
  - **Complexity**: Managing multi-role hierarchies will increase the metadata size for each contract instance.
