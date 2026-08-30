import { describe, expect, it } from "vitest";
import { validateCourseForm, type CourseFormValues } from "./CourseManagement";

const validCourse: CourseFormValues = {
  title: "Soroban Fundamentals",
  description: "Learn to build and deploy your first Soroban contract.",
  coverImage: "https://example.com/cover.jpg",
  instructor: "Penielka",
  category: "Development",
  difficulty: "beginner",
  estimatedDuration: "90",
};

describe("validateCourseForm", () => {
  it("accepts a complete course", () => {
    expect(validateCourseForm(validCourse)).toEqual({});
  });

  it("requires the course fields needed for publishing", () => {
    expect(validateCourseForm({ ...validCourse, title: "", category: "", estimatedDuration: "0" })).toEqual({
      title: "Enter a course title with at least 3 characters.",
      category: "Select a course category.",
      estimatedDuration: "Enter an estimated duration in minutes.",
    });
  });

  it("rejects malformed cover image URLs", () => {
    expect(validateCourseForm({ ...validCourse, coverImage: "cover-image" }).coverImage).toBe(
      "Use a valid image URL beginning with http:// or https://.",
    );
  });
});
