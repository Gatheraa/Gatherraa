import { participationMetricsData } from "./analytics.mock";

export const ParticipationMetricsWidget = () => {
  const { totalAttendees, checkedIn, droppedOff } =
    participationMetricsData;

  return (
    <div className="widget-card">
      <h3>Participation Metrics</h3>

      <div className="stats">
        <p>Total Attendees: {totalAttendees}</p>
        <p>Checked In: {checkedIn}</p>
        <p>Dropped Off: {droppedOff}</p>
      </div>
    </div>
  );
};