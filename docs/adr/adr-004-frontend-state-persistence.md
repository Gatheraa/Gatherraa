# ADR-004: Frontend State Persistence

- **Status**: Accepted
- **Created**: March 29, 2026
- **Context**: The Gathera frontend handles multi-step forms like event creation and ticket purchasing. If the user refreshes or navigates away, their progress is lost.
- **Decision**: We have decided to implement a `PersistentFormWrapper` component in the Next.js frontend to save form input to `localStorage`/`sessionStorage` automatically:
  1.  **localStorage**: Used for persistent across sessions (e.g., event drafts).
  2.  **sessionStorage**: Used for single-session persistence (e.g., ticket purchase details).
  3.  **Restore Logic**: On mount, the component checks the storage and fills the form state.
- **Consequences**:
  - **Improved UX**: Users can't lose their data easily.
  - **Ease of Use**: A single wrapper component can be applied to any form.
  - **Security**: Sensitive data must be excluded from this persistence mechanism (e.g., private keys, password fields).
