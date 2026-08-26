#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, Address};

    #[test]
    fn test_partial_and_complete_progress() {
        let env = Env::default();
        env.mock_all_auths();
        
        let student = Address::generate(&env);
        let module_id = 1_u64;

        let record = ModuleProgressRecord {
            student: student.clone(),
            module_id,
            completed_lessons: 3,
            total_required_lessons: 4,
        };

        env.storage().persistent().set(&(&student, &module_id), &record);

        let progress = ModuleProgressContract::get_module_progress(env.clone(), student.clone(), module_id).unwrap();
        assert_eq!(progress, 75);

        let completed = ModuleProgressContract::is_module_completed(env.clone(), student.clone(), module_id).unwrap();
        assert!(!completed);
    }
}