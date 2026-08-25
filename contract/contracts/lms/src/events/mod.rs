mod types;

pub use types::{
    AssessmentSubmitted, CertificateIssued, CourseArchived, CourseCompleted, CourseCreated,
    CoursePublished, LessonCompleted, LessonCreated, ModuleCreated, StudentEnrolled,
    StudentUnenrolled,
};

use soroban_sdk::{Address, Env};

/// Publish the event emitted when a course is registered.
pub fn course_created(env: &Env, course_id: u32, creator: &Address, total_lessons: u32) {
    CourseCreated {
        course_id,
        creator: creator.clone(),
        total_lessons,
    }
    .publish(env);
}

/// Publish the event emitted when a course becomes available to students.
pub fn course_published(env: &Env, course_id: u32, publisher: &Address) {
    CoursePublished {
        course_id,
        publisher: publisher.clone(),
    }
    .publish(env);
}

/// Publish the event emitted when a course is archived.
pub fn course_archived(env: &Env, course_id: u32, archiver: &Address) {
    CourseArchived {
        course_id,
        archiver: archiver.clone(),
    }
    .publish(env);
}

/// Publish the event emitted when a module is added to a course.
pub fn module_created(env: &Env, course_id: u32, module_id: u32, creator: &Address) {
    ModuleCreated {
        course_id,
        module_id,
        creator: creator.clone(),
    }
    .publish(env);
}

/// Publish the event emitted when a lesson is added to a module.
pub fn lesson_created(
    env: &Env,
    course_id: u32,
    module_id: u32,
    lesson_id: u32,
    creator: &Address,
) {
    LessonCreated {
        course_id,
        module_id,
        lesson_id,
        creator: creator.clone(),
    }
    .publish(env);
}

/// Publish the event emitted when a student enrolls in a course.
pub fn student_enrolled(env: &Env, course_id: u32, student: &Address) {
    StudentEnrolled {
        course_id,
        student: student.clone(),
    }
    .publish(env);
}

/// Publish the event emitted when a student withdraws from a course.
pub fn student_unenrolled(env: &Env, course_id: u32, student: &Address) {
    StudentUnenrolled {
        course_id,
        student: student.clone(),
    }
    .publish(env);
}

/// Publish the event emitted after a lesson is marked complete.
pub fn lesson_completed(env: &Env, course_id: u32, lesson_index: u32, student: &Address) {
    LessonCompleted {
        course_id,
        lesson_index,
        student: student.clone(),
    }
    .publish(env);
}

/// Publish the event emitted after all lessons in a course are complete.
pub fn course_completed(env: &Env, course_id: u32, student: &Address) {
    CourseCompleted {
        course_id,
        student: student.clone(),
    }
    .publish(env);
}

/// Publish the event emitted after an assessment attempt is persisted.
pub fn assessment_submitted(
    env: &Env,
    assessment_id: u64,
    student: &Address,
    attempt: u32,
    score: u32,
    passed: bool,
) {
    AssessmentSubmitted {
        assessment_id,
        student: student.clone(),
        attempt,
        score,
        passed,
    }
    .publish(env);
}

/// Publish the event emitted after a certificate is issued.
pub fn certificate_issued(env: &Env, certificate_id: u64, course_id: u32, student: &Address) {
    CertificateIssued {
        certificate_id,
        course_id,
        student: student.clone(),
    }
    .publish(env);
}
