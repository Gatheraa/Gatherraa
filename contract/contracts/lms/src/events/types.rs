use soroban_sdk::{contractevent, Address};

#[contractevent(topics = ["lms", "course_created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseCreated {
    #[topic]
    pub course_id: u32,
    pub creator: Address,
    pub total_lessons: u32,
}

#[contractevent(topics = ["lms", "course_published"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CoursePublished {
    #[topic]
    pub course_id: u32,
    pub publisher: Address,
}

#[contractevent(topics = ["lms", "course_archived"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseArchived {
    #[topic]
    pub course_id: u32,
    pub archiver: Address,
}

#[contractevent(topics = ["lms", "module_created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModuleCreated {
    #[topic]
    pub course_id: u32,
    #[topic]
    pub module_id: u32,
    pub creator: Address,
}

#[contractevent(topics = ["lms", "lesson_created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LessonCreated {
    #[topic]
    pub course_id: u32,
    #[topic]
    pub module_id: u32,
    #[topic]
    pub lesson_id: u32,
    pub creator: Address,
}

#[contractevent(topics = ["lms", "student_enrolled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StudentEnrolled {
    #[topic]
    pub course_id: u32,
    #[topic]
    pub student: Address,
}

#[contractevent(topics = ["lms", "student_unenrolled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StudentUnenrolled {
    #[topic]
    pub course_id: u32,
    #[topic]
    pub student: Address,
}

#[contractevent(topics = ["lms", "lesson_completed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LessonCompleted {
    #[topic]
    pub course_id: u32,
    #[topic]
    pub lesson_index: u32,
    #[topic]
    pub student: Address,
}

#[contractevent(topics = ["lms", "course_completed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseCompleted {
    #[topic]
    pub course_id: u32,
    #[topic]
    pub student: Address,
}

#[contractevent(topics = ["lms", "assessment_submitted"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AssessmentSubmitted {
    #[topic]
    pub assessment_id: u64,
    #[topic]
    pub student: Address,
    pub attempt: u32,
    pub score: u32,
    pub passed: bool,
}

#[contractevent(topics = ["lms", "certificate_issued"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificateIssued {
    #[topic]
    pub certificate_id: u64,
    #[topic]
    pub course_id: u32,
    #[topic]
    pub student: Address,
}
