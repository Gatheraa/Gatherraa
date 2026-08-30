"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  Clock3,
  Eye,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

export type CourseStatus = "draft" | "published" | "archived";
export type CourseDifficulty = "beginner" | "intermediate" | "advanced";

export interface CourseFormValues {
  title: string;
  description: string;
  coverImage: string;
  instructor: string;
  category: string;
  difficulty: CourseDifficulty;
  estimatedDuration: string;
}

export interface Course extends CourseFormValues {
  id: string;
  status: CourseStatus;
  publishedDate: string | null;
  updatedAt: string;
}

export interface CourseManagementProps {
  initialCourses?: Course[];
  onCreateCourse?: (course: Course) => void | Promise<void>;
  onUpdateCourse?: (course: Course) => void | Promise<void>;
}

type CourseErrors = Partial<Record<keyof CourseFormValues, string>>;

const EMPTY_FORM: CourseFormValues = {
  title: "",
  description: "",
  coverImage: "",
  instructor: "",
  category: "",
  difficulty: "beginner",
  estimatedDuration: "",
};

const CATEGORIES = ["Blockchain", "Development", "Design", "Business", "Community"];
const STATUS_FILTERS: Array<{ value: "all" | CourseStatus; label: string }> = [
  { value: "all", label: "All courses" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function validateCourseForm(values: CourseFormValues): CourseErrors {
  const errors: CourseErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = "Enter a course title with at least 3 characters.";
  }
  if (values.description.trim().length < 10) {
    errors.description = "Add a description with at least 10 characters.";
  }
  if (values.coverImage.trim()) {
    try {
      const url = new URL(values.coverImage);
      if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported protocol");
    } catch {
      errors.coverImage = "Use a valid image URL beginning with http:// or https://.";
    }
  }
  if (values.instructor.trim().length < 2) {
    errors.instructor = "Enter the instructor name.";
  }
  if (!values.category) {
    errors.category = "Select a course category.";
  }
  const duration = Number(values.estimatedDuration);
  if (!Number.isInteger(duration) || duration <= 0) {
    errors.estimatedDuration = "Enter an estimated duration in minutes.";
  }

  return errors;
}

function makeCourse(values: CourseFormValues, status: CourseStatus, existing?: Course): Course {
  const now = new Date().toISOString();
  return {
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    coverImage: values.coverImage.trim(),
    instructor: values.instructor.trim(),
    category: values.category.trim(),
    estimatedDuration: String(Number(values.estimatedDuration)),
    id: existing?.id ?? `course-${Date.now()}`,
    status,
    publishedDate: status === "published" ? existing?.publishedDate ?? now : null,
    updatedAt: now,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusClasses(status: CourseStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300";
  if (status === "archived") return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300";
}

export default function CourseManagement({
  initialCourses = [],
  onCreateCourse,
  onUpdateCourse,
}: CourseManagementProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [form, setForm] = useState<CourseFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CourseErrors>({});
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | CourseStatus>("all");
  const [isFormOpen, setIsFormOpen] = useState(initialCourses.length === 0);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredCourses = useMemo(
    () => statusFilter === "all" ? courses : courses.filter((course) => course.status === statusFilter),
    [courses, statusFilter],
  );

  const counts = useMemo(() => ({
    all: courses.length,
    draft: courses.filter((course) => course.status === "draft").length,
    published: courses.filter((course) => course.status === "published").length,
    archived: courses.filter((course) => course.status === "archived").length,
  }), [courses]);

  const updateField = (field: keyof CourseFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditingCourseId(null);
    setIsFormOpen(false);
  };

  const editCourse = (course: Course) => {
    setForm({
      title: course.title,
      description: course.description,
      coverImage: course.coverImage,
      instructor: course.instructor,
      category: course.category,
      difficulty: course.difficulty,
      estimatedDuration: course.estimatedDuration,
    });
    setEditingCourseId(course.id);
    setErrors({});
    setNotice(null);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveCourse = async (status: CourseStatus) => {
    const validationErrors = validateCourseForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setNotice("Review the highlighted fields before saving the course.");
      return;
    }

    const existing = courses.find((course) => course.id === editingCourseId);
    const course = makeCourse(form, status, existing);
    setCourses((current) => existing
      ? current.map((item) => item.id === existing.id ? course : item)
      : [course, ...current]);

    if (existing) {
      await onUpdateCourse?.(course);
    } else {
      await onCreateCourse?.(course);
    }

    setNotice(status === "published" ? "Course published successfully." : "Course saved as a draft.");
    setForm(EMPTY_FORM);
    setErrors({});
    setEditingCourseId(null);
    setIsFormOpen(false);
  };

  const updateCourseStatus = async (course: Course, status: CourseStatus) => {
    const updatedCourse = makeCourse(course, status, course);
    setCourses((current) => current.map((item) => item.id === course.id ? updatedCourse : item));
    await onUpdateCourse?.(updatedCourse);
    setNotice(status === "archived" ? "Course archived." : "Course restored as a draft.");
  };

  const removeCourse = async (course: Course) => {
    if (course.status !== "archived") return;
    setCourses((current) => current.filter((item) => item.id !== course.id));
    setNotice("Archived course deleted.");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-[var(--border-default)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Learning management
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Course management</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Create, publish, and maintain the learning courses available to your community.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setIsFormOpen(true); setNotice(null); }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New course
        </button>
      </header>

      {notice && (
        <div role="status" className="flex items-center gap-2 border-l-4 border-[var(--color-success)] bg-[var(--color-success-muted)] px-4 py-3 text-sm text-[var(--color-success-muted-foreground)]">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}

      {isFormOpen && (
        <section aria-labelledby="course-form-title" className="border border-[var(--border-default)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 id="course-form-title" className="text-xl font-semibold text-[var(--text-primary)]">
                {editingCourseId ? "Edit course" : "Create a course"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Add the course details, then save a draft or publish it immediately.</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              aria-label="Close course form"
              title="Close course form"
              className="rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void saveCourse("draft"); }} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-5 sm:grid-cols-2">
              <CourseField label="Course title" error={errors.title} className="sm:col-span-2">
                <input value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="e.g. Build your first Soroban contract" className={inputClasses(Boolean(errors.title))} />
              </CourseField>

              <CourseField label="Description" error={errors.description} className="sm:col-span-2">
                <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="What will learners be able to do after completing this course?" rows={5} className={`${inputClasses(Boolean(errors.description))} resize-y`} />
              </CourseField>

              <CourseField label="Instructor" error={errors.instructor}>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  <input value={form.instructor} onChange={(event) => updateField("instructor", event.target.value)} placeholder="Instructor name" className={`${inputClasses(Boolean(errors.instructor))} pl-10`} />
                </div>
              </CourseField>

              <CourseField label="Category" error={errors.category}>
                <select value={form.category} onChange={(event) => updateField("category", event.target.value)} className={inputClasses(Boolean(errors.category))}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </CourseField>

              <CourseField label="Difficulty level">
                <select value={form.difficulty} onChange={(event) => updateField("difficulty", event.target.value)} className={inputClasses(false)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </CourseField>

              <CourseField label="Estimated duration (minutes)" error={errors.estimatedDuration}>
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  <input type="number" min="1" step="1" value={form.estimatedDuration} onChange={(event) => updateField("estimatedDuration", event.target.value)} placeholder="90" className={`${inputClasses(Boolean(errors.estimatedDuration))} pl-10`} />
                </div>
              </CourseField>

              <CourseField label="Cover image URL" error={errors.coverImage} className="sm:col-span-2">
                <div className="relative">
                  <ImageIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  <input type="url" value={form.coverImage} onChange={(event) => updateField("coverImage", event.target.value)} placeholder="https://example.com/course-cover.jpg" className={`${inputClasses(Boolean(errors.coverImage))} pl-10`} />
                </div>
              </CourseField>

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border-default)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-elevated)]">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Save draft
                </button>
                <button type="button" onClick={() => { void saveCourse("published"); }} className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]">
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Publish course
                </button>
                {editingCourseId && (
                  <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-elevated)]">
                    Cancel editing
                  </button>
                )}
              </div>
            </div>

            <div className="border border-dashed border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Eye className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
                Cover preview
              </div>
              {form.coverImage ? (
                <div className="aspect-video overflow-hidden bg-[var(--gray-200)] dark:bg-[var(--gray-800)]">
                  <img src={form.coverImage} alt="Course cover preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 border border-[var(--border-default)] text-center text-sm text-[var(--text-muted)]">
                  <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  Add an image URL to preview the cover.
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">A clear cover image helps learners identify the course in the catalog.</p>
            </div>
          </form>
        </section>
      )}

      <section aria-labelledby="course-list-title">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="course-list-title" className="text-xl font-semibold text-[var(--text-primary)]">Your courses</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{counts.all} {counts.all === 1 ? "course" : "courses"} in your workspace</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter courses by status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={statusFilter === filter.value}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${statusFilter === filter.value ? "bg-[var(--color-primary)] text-white" : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              >
                {filter.label} ({counts[filter.value]})
              </button>
            ))}
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="border border-dashed border-[var(--border-default)] px-6 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-[var(--text-muted)]" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">No courses here yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">Create your first course and save it as a draft while you prepare the content.</p>
            <button type="button" onClick={() => setIsFormOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create course
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <article key={course.id} className="flex flex-col border border-[var(--border-default)] bg-[var(--surface)] shadow-sm">
                <div className="relative aspect-[16/8] overflow-hidden bg-[var(--surface-elevated)]">
                  {course.coverImage ? <img src={course.coverImage} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[var(--text-muted)]"><ImageIcon className="h-8 w-8" aria-hidden="true" /></div>}
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(course.status)}`}>{course.status}</span>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div>
                    <h3 className="line-clamp-2 text-lg font-semibold text-[var(--text-primary)]">{course.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{course.description}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 border-y border-[var(--border-muted)] py-3 text-xs">
                    <div><dt className="text-[var(--text-muted)]">Instructor</dt><dd className="mt-1 font-medium text-[var(--text-primary)]">{course.instructor}</dd></div>
                    <div><dt className="text-[var(--text-muted)]">Duration</dt><dd className="mt-1 font-medium text-[var(--text-primary)]">{course.estimatedDuration} min</dd></div>
                    <div><dt className="text-[var(--text-muted)]">Category</dt><dd className="mt-1 font-medium text-[var(--text-primary)]">{course.category}</dd></div>
                    <div><dt className="text-[var(--text-muted)]">Published</dt><dd className="mt-1 font-medium text-[var(--text-primary)]">{formatDate(course.publishedDate)}</dd></div>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <button type="button" onClick={() => editCourse(course)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]">
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    {course.status === "draft" && (
                      <button type="button" onClick={() => void updateCourseStatus(course, "published")} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]">
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        Publish
                      </button>
                    )}
                    {course.status === "published" && (
                      <button type="button" onClick={() => void updateCourseStatus(course, "archived")} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-warning)] px-3 py-2 text-xs font-semibold text-[var(--color-warning-muted-foreground)] hover:bg-[var(--color-warning-muted)]">
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        Archive
                      </button>
                    )}
                    {course.status === "archived" && (
                      <>
                        <button type="button" onClick={() => void updateCourseStatus(course, "draft")} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--border-default)]">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Restore draft
                        </button>
                        <button type="button" onClick={() => void removeCourse(course)} aria-label={`Delete ${course.title}`} title="Delete archived course" className="ml-auto rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--color-error-muted)] hover:text-[var(--color-error)]">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function inputClasses(hasError: boolean) {
  return `w-full rounded-md border bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 ${hasError ? "border-[var(--color-error)]" : "border-[var(--border-default)] focus:border-[var(--color-primary)]"}`;
}

function CourseField({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1.5 text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
