import RouteGuard from "@/components/auth/RouteGuard";
import CreateEventForm from "@/components/forms/CreateEventForm";

export default function Page() {
  return (
    <RouteGuard requiredRole="organizer" skeleton="event">
      <CreateEventForm />
    </RouteGuard>
  );
}
