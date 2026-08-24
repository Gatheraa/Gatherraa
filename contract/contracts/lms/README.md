# LMS Contract

Soroban contract backing the Gathera Learning Management System.

## Status

The contract's implemented surface today is **initialization, access
control, and certificate issuance/retrieval**. The wider LMS — courses,
modules, lessons, enrollment, progress, assessments, completion-gated
certificates, events, and queries — is being built out across issues
#638–#657, and each module lands with its own entry points.

| Area | Issue | State |
|---|---|---|
| Contract scaffold | #638 | Done |
| Access control | #638 | Done, exposed |
| Integration + testnet deployment | #657 | This work |
| Course progress calculation | #648 | PR open |
| Assessment module | #651, #652 | Assigned |
| Course / module / lesson management | #640–#644 | Open |
| Enrollment and payment | #645, #646 | Open |
| Course completion | #650 | Open |
| Certificates | #653, #654 | #653 done |
| Events | #655 | Open |
| Read / query interface | #656 | Open |

Anything not listed as done has no on-chain behaviour yet. Do not integrate
against it.

## Public interface

Every callable method, with the exact wire signature. Anything not in this
table is internal and unreachable from off-chain.

| Method | Auth required | Returns |
|---|---|---|
| `initialize(admin: Address)` | `admin` | `Result<(), AccessError>` |
| `is_initialized()` | none | `bool` |
| `version()` | none | `LmsVersion` |
| `register_admin(caller: Address, admin: Address)` | `caller`, must be Admin | `Result<(), AccessError>` |
| `authorize_instructor(caller: Address, instructor: Address)` | `caller`, must be Admin | `Result<(), AccessError>` |
| `register_student(student: Address)` | `student` | `Result<(), AccessError>` |
| `get_role(user: Address)` | none | `Option<Role>` |
| `get_user(user: Address)` | none | `Option<UserRecord>` |
| `has_role(user: Address, role: Role)` | none | `bool` |
| `issue_certificate(caller: Address, student: Address, course_id: u32, metadata_uri: String)` | `caller`, must be staff | `Result<Certificate, CertificateError>` |
| `get_certificate(certificate_id: u64)` | none | `Option<Certificate>` |

`Role` is one of `Admin`, `Instructor`, `Student`. `UserRecord` is
`{ address: Address, role: Role }`. `Certificate` is
`{ certificate_id: u64, student: Address, course_id: u32, issued_at: u64, metadata_uri: String }`.

### Error codes

`AccessError`, as returned by the fallible methods above:

| Code | Variant | Meaning |
|---|---|---|
| 1 | `Unauthorized` | Caller lacks the required role |
| 2 | `AlreadyRegistered` | Target address already holds a role |
| 3 | `UserNotRegistered` | Caller holds no role at all |
| 4 | `AdminRequired` | Operation needs administrator privileges |
| 5 | `InstructorRequired` | Operation needs instructor privileges |
| 6 | `AdminNotInitialized` | Reserved |
| 7 | `AlreadyInitialized` | Contract has already been initialized |

Note the distinction between `UserNotRegistered` (3) and `AdminRequired`
(4). A caller with no role at all gets 3; a caller with the *wrong* role
gets 4. The two are deliberately separate so a client can tell "you need to
register" from "you need a promotion".

### Certificate error codes

`CertificateError`, as returned by `issue_certificate`:

| Code | Variant | Meaning |
|---|---|---|
| 1 | `Unauthorized` | Caller is not staff (admin or instructor) |
| 2 | `InvalidMetadataUri` | `metadata_uri` is empty |

## Initialization

`initialize` registers the contract's first administrator, and it is the
**only** route to an administrator role that does not require an existing
administrator's approval. It therefore runs exactly once. A second call
fails with `AlreadyInitialized` (7), whatever address makes it.

This matters operationally: **between deployment and initialization, the
contract is live and unowned.** Whoever calls `initialize` first becomes its
permanent administrator. Deploy and initialize as one step —
`scripts/deploy_lms.sh` does, and it verifies `is_initialized` on-chain
afterwards rather than trusting the invoke's exit code.

A failed initialization does not consume the one-time chance. If
`initialize` is rejected, the marker is not set and the contract can still
be initialized properly.

Once initialized, roles are granted like this:

```
initialize(admin)                          -> admin becomes Admin
admin: authorize_instructor(admin, alice)  -> alice becomes Instructor
admin: register_admin(admin, bob)          -> bob becomes Admin
carol: register_student(carol)             -> carol becomes Student
```

Students self-register; staff roles are granted by an administrator. One
address holds at most one role — granting a second fails with
`AlreadyRegistered` (2), and the original role survives the attempt.

## Build

```bash
cd contract
cargo build -p lms --target wasm32-unknown-unknown --release
```

The artifact lands at
`contract/target/wasm32-unknown-unknown/release/lms.wasm`.

The release profile sets `overflow-checks = true`, so arithmetic that would
wrap silently in a normal release build panics here instead. Build and test
in release when changing anything numeric.

## Test

```bash
cd contract
cargo test -p lms
```

Two suites, both required to pass:

- **Unit tests** in `src/`, reaching module functions directly.
- **Integration tests** in `tests/integration.rs`, going through
  `LmsContractClient` — the client Soroban generates from the
  `#[contractimpl]` block. Every call there is a real contract invocation
  with its own frame and its own authorization check, which is the only way
  to catch a function that is correct internally but unreachable or wrongly
  authorized from outside.

### Two things that will bite you when writing tests

**Storage access is only legal inside a contract invocation.** Calling a
module function directly from a test aborts with
`Error(Context, InternalError)` — "no contract running". Unit tests wrap
calls in `env.as_contract`; integration tests get this for free by going
through the client.

**Each call needs its own frame.** Two `require_auth()` calls on the same
address inside one frame fail with `Error(Auth, ExistingValue)` — "frame is
already authorized". Batching several operations into one `as_contract`
block fails for reasons unrelated to the code under test. The unit tests
use a `call()` helper giving one frame per call, which is also how these
functions are reached in production: one invocation per transaction.

### Known blocker on a clean clone

`contract/Cargo.lock` is committed as of this work. Before that it was
gitignored, and a fresh clone would resolve `ed25519-dalek 3.0.0` for
`soroban-env-host`, which does not compile against it:

```
error[E0277]: the trait bound `...: CryptoRng` is not satisfied
error: could not compile `soroban-env-host` (lib)
```

If you hit this after regenerating the lockfile:

```bash
cd contract
cargo update -p ed25519-dalek@3.0.0 --precise 2.2.0
```

## Deploy to testnet

```bash
export SOROBAN_ACCOUNT_SECRET=S...      # funded key
./scripts/deploy_lms.sh testnet
```

The script builds, optimizes if the CLI supports it, deploys, initializes,
and then verifies `is_initialized` on-chain. It exits non-zero on any
failure. The contract ID is written to
`deployment/testnet/lms_contract_address.txt` and the admin address to
`lms_admin_address.txt`.

Options:

| Variable | Effect |
|---|---|
| `SOROBAN_ACCOUNT_SECRET` | Required. Funded secret key. |
| `SOROBAN_NETWORK` | Network name; default `testnet`. Also accepted as `$1`. |
| `LMS_ADMIN` | Admin address; defaults to the deploying account. |
| `SKIP_INIT=1` | Deploy without initializing. Leaves the contract unowned — see above. |

Note: `scripts/deploy_contracts.sh` is a **mock**. It echoes hardcoded
contract addresses and writes them to `deployment/` as though a deployment
succeeded. It does not deploy anything, and it does not cover the LMS. Use
`deploy_lms.sh`.

## Interact

Reads need no signing:

```bash
stellar contract invoke --id "$CONTRACT_ID" --network testnet \
  --source-account "$SOROBAN_ACCOUNT_SECRET" \
  -- get_role --user "$SOME_ADDRESS"
```

Writes are authorized by the address named in the call — `caller` for staff
operations, `student` for self-registration:

```bash
# Admin authorizes an instructor.
stellar contract invoke --id "$CONTRACT_ID" --network testnet \
  --source-account "$ADMIN_SECRET" \
  -- authorize_instructor --caller "$ADMIN_ADDRESS" --instructor "$INSTRUCTOR_ADDRESS"

# A learner registers themselves.
stellar contract invoke --id "$CONTRACT_ID" --network testnet \
  --source-account "$STUDENT_SECRET" \
  -- register_student --student "$STUDENT_ADDRESS"
```

Substitute `soroban` for `stellar` on older CLI installs.

## Layout

```
contracts/lms/
├── Cargo.toml
├── README.md
├── src/
│   ├── lib.rs          crate root and public exports
│   ├── contract.rs      the #[contractimpl] surface — everything callable
│   ├── storage.rs       StorageKey, shared across modules
│   ├── types.rs         LmsVersion
│   ├── error.rs         top-level Error
│   ├── certificate/     certificate issuance and retrieval
│   │   ├── mod.rs       CertificateService
│   │   ├── errors.rs    CertificateError
│   │   ├── storage.rs   certificate persistence and id counter
│   │   └── types.rs     Certificate
│   └── access/          roles and authorization
│       ├── mod.rs       AccessControl service
│       ├── errors.rs    AccessError
│       ├── storage.rs   role and initialization persistence
│       └── types.rs     Role, UserRecord
└── tests/
    └── integration.rs   client-level tests
```

New modules should follow `access/`: a `mod.rs` service, plus module-local
`errors.rs`, `storage.rs`, and `types.rs`. Add entry points to
`contract.rs` — a module with no `#[contractimpl]` wiring is unreachable
from off-chain, however complete its internals — and extend
`tests/integration.rs` rather than starting a new integration file.

## Storage

| Key | Durability | Holds |
|---|---|---|
| `Configuration` | instance | Interface version; presence marks the contract initialized |
| `User(Address)` | persistent | That address's `Role` |
| `Certificate(u64)` | persistent | The issued `Certificate`, keyed by certificate id |
| `CertificateCounter` | instance | Monotonic counter allocating unique certificate ids |

Contract-level configuration lives in instance storage: there is one of it
and it shares the contract's lifetime and archival. Per-user records live in
persistent storage, where they are keyed and extended individually.
