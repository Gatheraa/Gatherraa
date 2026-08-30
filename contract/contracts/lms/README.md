# LMS Contract

Soroban contract backing the Gathera Learning Management System.

## Status

The contract's implemented surface today is **initialization and access
control**. The wider LMS — courses, modules, lessons, enrollment, progress,
assessments, certificates, events, and queries — is being built out across
issues #638–#657, and each module lands with its own entry points.

| Area | Issue | State |
|---|---|---|
| Contract scaffold | #638 | Done |
| Access control | #638 | Done, exposed |
| Integration + testnet deployment | #657 | This work |
| Course progress calculation | #648 | PR open |
| Assessment module | #651, #652 | Assigned |
| Course management | #640–#642 | Open |
| Module management | #643 | Done, exposed |
| Lesson management | #644 | Open |
| Enrollment and payment | #645, #646 | Open |
| Course completion | #650 | Open |
| Certificates | #653, #654 | Open |
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
| `create_course(caller, course_id, instructor, title, description_uri, price, total_lessons)` | `caller`, must be staff | `Result<(), CourseError>` |
| `get_course(course_id: u32)` | none | `Option<Course>` |
| `create_module(caller, course_id, module_id, title, description_uri, position)` | `caller`, must be the course's instructor | `Result<(), ModuleError>` |
| `update_module(caller, module_id, title, description_uri, position)` | `caller`, must be the owning course's instructor | `Result<(), ModuleError>` |
| `delete_module(caller, module_id)` | `caller`, must be the owning course's instructor | `Result<(), ModuleError>` |
| `get_module(module_id: u32)` | none | `Option<Module>` |

`Role` is one of `Admin`, `Instructor`, `Student`. `UserRecord` is
`{ address: Address, role: Role }`.

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

`CourseError`, as returned by the course methods above:

| Code | Variant | Meaning |
|---|---|---|
| 1 | `CourseAlreadyExists` | A course with that id already exists |
| 2 | `CourseNotFound` | No course with that id |
| 3 | `Unauthorized` | Caller lacks a staff role |
| 4 | `UserNotRegistered` | Caller holds no role at all |

`ModuleError`, as returned by the module methods above:

| Code | Variant | Meaning |
|---|---|---|
| 1 | `ModuleAlreadyExists` | A module with that id already exists |
| 2 | `ModuleNotFound` | No module with that id |
| 3 | `CourseNotFound` | No course with that id — modules cannot be created for nonexistent courses |
| 4 | `Unauthorized` | Caller is not the owning course's instructor |
| 5 | `UserNotRegistered` | Caller holds no role at all |

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

## Modules

Modules organize a course's lessons into ordered sections. A module is
created against an existing course, and the module's `course_id` is fixed
for its lifetime — moving a module between courses is delete-and-recreate.
Ordering is expressed with the caller-supplied `position` field, so an
authoring UI decides the curriculum order and `update_module` can reorder
by writing new positions.

Authorization for module operations is deliberately narrower than course
creation. Course creation takes any staff member; module creation, update,
and deletion additionally require the caller to be **that course's
instructor** (per the course record), not merely any instructor or admin.
Modules cannot be created for courses that do not exist — the course lookup
doubles as the ownership anchor, because the course record carries the
instructor's address.

```
initialize(admin)                                   -> admin becomes Admin
admin: authorize_instructor(admin, alice)           -> alice becomes Instructor
alice: create_course(alice, 1, alice, ...)          -> course 1, instructor alice
alice: create_module(alice, 1, 101, ...)            -> module 101 under course 1
bob (also an Instructor): create_module(bob, 1, ...) -> Unauthorized — course 1 is alice's
```

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
│   └── access/          roles and authorization
│       ├── mod.rs       AccessControl service
│       ├── errors.rs    AccessError
│       ├── storage.rs   role and initialization persistence
│       └── types.rs     Role, UserRecord
│   ├── module/          course modules (issue #643)
│   │   ├── mod.rs       Modules service
│   │   ├── errors.rs    ModuleError
│   │   ├── storage.rs   module persistence
│   │   └── types.rs     Module
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
| `Course(u32)` | persistent | A `Course` record |
| `Module(u32)` | persistent | A `Module` record |

Contract-level configuration lives in instance storage: there is one of it
and it shares the contract's lifetime and archival. Per-user records live in
persistent storage, where they are keyed and extended individually.
