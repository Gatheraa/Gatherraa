import { attendeeEngagementData } from "./analytics.mock";

export const AttendeeEngagementWidget = () => {
  const { activeUsers, messagesSent, reactions } = attendeeEngagementData;

  return (
    <div className="widget-card">
      <h3>Attendee Engagement</h3>

      <div className="stats">
        <p>Active Users: {activeUsers}</p>
        <p>Messages Sent: {messagesSent}</p>
        <p>Reactions: {reactions}</p>
      </div>
    </div>
  );
};