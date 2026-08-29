import RouteGuard from "@/components/auth/RouteGuard";
import CourseManagement from "@/components/courses/CourseManagement";

export default function CourseManagementPage() {
  return (
    <RouteGuard requiredRole="organizer" skeleton="dashboard">
      <CourseManagement />
    </RouteGuard>
  );
}
