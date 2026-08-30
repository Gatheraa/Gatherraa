pub mod errors;
pub mod storage;
pub mod types;

pub use errors::ModuleError;
pub use types::Module;

use soroban_sdk::{Address, Env, String};

use crate::access::{AccessControl, AccessError};
use crate::course::Courses;
use crate::events;

/// Module management operations for the LMS contract.
pub struct Modules;

impl Modules {
    /// Create and persist a module under an existing course.
    ///
    /// Only the course's own instructor may add modules to it. The course
    /// must already exist — a module for a nonexistent course is rejected
    /// before any state is written.
    ///
    /// `position` is the module's place in the course curriculum. It is
    /// caller-supplied so ordering can be decided off-chain (by the author
    /// or an editing UI) rather than guessed from insertion order.
    ///
    /// # Errors
    /// * `CourseNotFound` — no course is registered under `course_id`
    /// * `ModuleAlreadyExists` — a module is already registered under `module_id`
    /// * `Unauthorized` — the caller is not the course's instructor
    /// * `UserNotRegistered` — the caller has no role at all
    pub fn create_module(
        env: &Env,
        caller: &Address,
        course_id: u32,
        module_id: u32,
        title: String,
        description_uri: String,
        position: u32,
    ) -> Result<(), ModuleError> {
        Self::require_course_instructor(env, caller, course_id)?;

        if storage::has_module(env, module_id) {
            return Err(ModuleError::ModuleAlreadyExists);
        }

        let timestamp = env.ledger().timestamp();
        storage::set_module(
            env,
            &Module {
                module_id,
                course_id,
                title,
                description_uri,
                position,
                created_at: timestamp,
                updated_at: timestamp,
            },
        );
        events::module_created(env, course_id, module_id, caller);

        Ok(())
    }

    /// Update the mutable fields of an existing module.
    ///
    /// A module's `course_id` is fixed at creation: modules belong to the
    /// course they were created under, and moving one between courses is a
    /// delete-and-recreate operation rather than an update. Everything else
    /// — title, description, and position — can be changed, and `updated_at`
    /// is refreshed while `created_at` is preserved.
    ///
    /// Only the course's own instructor may update its modules.
    ///
    /// # Errors
    /// * `ModuleNotFound` — no module is registered under `module_id`
    /// * `Unauthorized` — the caller is not the owning course's instructor
    /// * `UserNotRegistered` — the caller has no role at all
    pub fn update_module(
        env: &Env,
        caller: &Address,
        module_id: u32,
        title: String,
        description_uri: String,
        position: u32,
    ) -> Result<(), ModuleError> {
        let module = storage::get_module(env, module_id).ok_or(ModuleError::ModuleNotFound)?;

        Self::require_course_instructor(env, caller, module.course_id)?;

        storage::set_module(
            env,
            &Module {
                module_id: module.module_id,
                course_id: module.course_id,
                title,
                description_uri,
                position,
                created_at: module.created_at,
                updated_at: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Delete a module.
    ///
    /// Only the owning course's instructor may delete its modules.
    ///
    /// # Errors
    /// * `ModuleNotFound` — no module is registered under `module_id`
    /// * `Unauthorized` — the caller is not the owning course's instructor
    /// * `UserNotRegistered` — the caller has no role at all
    pub fn delete_module(env: &Env, caller: &Address, module_id: u32) -> Result<(), ModuleError> {
        let module = storage::get_module(env, module_id).ok_or(ModuleError::ModuleNotFound)?;

        Self::require_course_instructor(env, caller, module.course_id)?;

        storage::remove_module(env, module_id);

        Ok(())
    }

    /// Retrieve a module by its unique identifier.
    pub fn get_module(env: &Env, module_id: u32) -> Option<Module> {
        storage::get_module(env, module_id)
    }

    /// Require that `caller` be the instructor of the course `course_id`.
    ///
    /// Two distinct facts are checked here. First, the course must exist —
    /// this is the "modules cannot be created for nonexistent courses"
    /// invariant, and it doubles as the authorization anchor, because the
    /// course record carries the instructor's address. Second, the caller
    /// must be that instructor, not merely any staff member: authorizing
    /// an instructor does not give them control over courses they do not
    /// teach.
    ///
    /// The caller must still hold a staff role (admin or instructor) before
    /// the ownership check runs. A registered student reaching this point
    /// is `Unauthorized`, and an address with no role at all is
    /// `UserNotRegistered` — the same distinction the access module draws
    /// for every other privileged operation.
    fn require_course_instructor(
        env: &Env,
        caller: &Address,
        course_id: u32,
    ) -> Result<(), ModuleError> {
        AccessControl::require_staff(env, caller).map_err(|error| match error {
            AccessError::UserNotRegistered => ModuleError::UserNotRegistered,
            _ => ModuleError::Unauthorized,
        })?;

        let course = Courses::get_course(env, course_id).ok_or(ModuleError::CourseNotFound)?;

        if &course.instructor != caller {
            return Err(ModuleError::Unauthorized);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LmsContract;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Address, Env};

    /// Run one contract call.
    ///
    /// Storage access is only legal inside a contract invocation, so the
    /// module functions cannot be called straight from a test — the host
    /// rejects it with "no contract running". Each call also gets its own
    /// frame: two `require_auth()` calls for the same address inside one
    /// frame fail with `Error(Auth, ExistingValue)`, so operations cannot
    /// share a single `as_contract` block.
    fn call<T>(env: &Env, contract_id: &Address, f: impl FnOnce() -> T) -> T {
        env.as_contract(contract_id, f)
    }

    fn setup() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        let contract_id = env.register(LmsContract, ());

        let admin = Address::generate(&env);
        let instructor = Address::generate(&env);
        let other_instructor = Address::generate(&env);
        let student = Address::generate(&env);

        env.mock_all_auths();

        (
            env,
            contract_id,
            admin,
            instructor,
            other_instructor,
            student,
        )
    }

    fn seed_roles(
        env: &Env,
        contract_id: &Address,
        admin: &Address,
        instructor: &Address,
        other_instructor: &Address,
        student: &Address,
    ) {
        call(env, contract_id, || {
            AccessControl::initialize_admin(env, admin).unwrap()
        });
        call(env, contract_id, || {
            AccessControl::authorize_instructor(env, admin, instructor).unwrap()
        });
        call(env, contract_id, || {
            AccessControl::authorize_instructor(env, admin, other_instructor).unwrap()
        });
        call(env, contract_id, || {
            AccessControl::register_student(env, student).unwrap()
        });
    }

    /// Create a course owned by `instructor`.
    fn create_course(env: &Env, contract_id: &Address, instructor: &Address, course_id: u32) {
        call(env, contract_id, || {
            Courses::create_course(
                env,
                instructor,
                course_id,
                instructor,
                String::from_str(env, "Course"),
                String::from_str(env, "ipfs://course"),
                0,
                8,
            )
            .unwrap()
        });
    }

    fn create_module(
        env: &Env,
        contract_id: &Address,
        caller: &Address,
        course_id: u32,
        module_id: u32,
        position: u32,
    ) -> Result<(), ModuleError> {
        call(env, contract_id, || {
            Modules::create_module(
                env,
                caller,
                course_id,
                module_id,
                String::from_str(env, "Intro"),
                String::from_str(env, "ipfs://intro"),
                position,
            )
        })
    }

    #[test]
    fn an_instructor_can_create_a_module() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        env.ledger().with_mut(|ledger| ledger.timestamp = 1234);

        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();

        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 1)),
            Some(Module {
                module_id: 1,
                course_id: 7,
                title: String::from_str(&env, "Intro"),
                description_uri: String::from_str(&env, "ipfs://intro"),
                position: 1,
                created_at: 1234,
                updated_at: 1234,
            })
        );
    }

    #[test]
    fn a_module_cannot_be_created_for_a_nonexistent_course() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);

        assert_eq!(
            create_module(&env, &id, &instructor, 999, 1, 1),
            Err(ModuleError::CourseNotFound)
        );
        assert_eq!(call(&env, &id, || Modules::get_module(&env, 1)), None);
    }

    #[test]
    fn duplicate_module_ids_are_rejected() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();

        assert_eq!(
            create_module(&env, &id, &instructor, 7, 1, 2),
            Err(ModuleError::ModuleAlreadyExists)
        );

        // The original module is untouched by the rejected call.
        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 1))
                .unwrap()
                .position,
            1
        );
    }

    #[test]
    fn a_student_cannot_create_a_module() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        assert_eq!(
            create_module(&env, &id, &student, 7, 1, 1),
            Err(ModuleError::Unauthorized)
        );
    }

    #[test]
    fn an_unregistered_caller_cannot_create_a_module() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        let outsider = Address::generate(&env);

        assert_eq!(
            create_module(&env, &id, &outsider, 7, 1, 1),
            Err(ModuleError::UserNotRegistered)
        );
    }

    #[test]
    fn another_instructor_cannot_modify_a_course_they_do_not_own() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);
        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();

        assert_eq!(
            create_module(&env, &id, &other_instructor, 7, 2, 2),
            Err(ModuleError::Unauthorized)
        );

        // ...and that extends to updating and deleting existing modules.
        assert_eq!(
            call(&env, &id, || Modules::update_module(
                &env,
                &other_instructor,
                1,
                String::from_str(&env, "Hijacked"),
                String::from_str(&env, "ipfs://hijacked"),
                9,
            )),
            Err(ModuleError::Unauthorized)
        );
        assert_eq!(
            call(&env, &id, || Modules::delete_module(
                &env,
                &other_instructor,
                1
            )),
            Err(ModuleError::Unauthorized)
        );

        // The module is untouched.
        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 1))
                .unwrap()
                .title,
            String::from_str(&env, "Intro")
        );
    }

    #[test]
    fn module_positions_are_stored_and_can_be_reordered() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();
        create_module(&env, &id, &instructor, 7, 2, 2).unwrap();
        create_module(&env, &id, &instructor, 7, 3, 3).unwrap();

        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 2))
                .unwrap()
                .position,
            2
        );

        // Reordering is expressed through position updates.
        call(&env, &id, || {
            Modules::update_module(
                &env,
                &instructor,
                1,
                String::from_str(&env, "Intro"),
                String::from_str(&env, "ipfs://intro"),
                5,
            )
            .unwrap()
        });

        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 1))
                .unwrap()
                .position,
            5
        );
        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 3))
                .unwrap()
                .position,
            3
        );
    }

    #[test]
    fn an_instructor_can_update_a_module() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        env.ledger().with_mut(|ledger| ledger.timestamp = 1000);
        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();

        env.ledger().with_mut(|ledger| ledger.timestamp = 2000);
        call(&env, &id, || {
            Modules::update_module(
                &env,
                &instructor,
                1,
                String::from_str(&env, "Advanced"),
                String::from_str(&env, "ipfs://advanced"),
                4,
            )
            .unwrap()
        });

        let module = call(&env, &id, || Modules::get_module(&env, 1)).unwrap();

        assert_eq!(module.title, String::from_str(&env, "Advanced"));
        assert_eq!(
            module.description_uri,
            String::from_str(&env, "ipfs://advanced")
        );
        assert_eq!(module.position, 4);
        assert_eq!(module.course_id, 7);
        assert_eq!(module.created_at, 1000);
        assert_eq!(module.updated_at, 2000);
    }

    #[test]
    fn updating_a_missing_module_is_rejected() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);

        assert_eq!(
            call(&env, &id, || Modules::update_module(
                &env,
                &instructor,
                99,
                String::from_str(&env, "Nope"),
                String::from_str(&env, "ipfs://nope"),
                1,
            )),
            Err(ModuleError::ModuleNotFound)
        );
    }

    #[test]
    fn an_instructor_can_delete_a_module() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);
        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();

        call(&env, &id, || {
            Modules::delete_module(&env, &instructor, 1).unwrap()
        });

        assert_eq!(call(&env, &id, || Modules::get_module(&env, 1)), None);

        // Deleting it again fails cleanly.
        assert_eq!(
            call(&env, &id, || Modules::delete_module(&env, &instructor, 1)),
            Err(ModuleError::ModuleNotFound)
        );
    }

    #[test]
    fn modules_are_tracked_per_course() {
        let (env, id, admin, instructor, other_instructor, student) = setup();
        seed_roles(&env, &id, &admin, &instructor, &other_instructor, &student);
        create_course(&env, &id, &instructor, 7);
        create_course(&env, &id, &instructor, 8);

        create_module(&env, &id, &instructor, 7, 1, 1).unwrap();
        create_module(&env, &id, &instructor, 8, 2, 1).unwrap();

        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 1))
                .unwrap()
                .course_id,
            7
        );
        assert_eq!(
            call(&env, &id, || Modules::get_module(&env, 2))
                .unwrap()
                .course_id,
            8
        );
    }
}
