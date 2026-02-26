export default function Page() {
  return (
    <RouteGuard requiredRole="organizer" skeleton="event">
      <CreateEventForm />
    </RouteGuard>
  );
}