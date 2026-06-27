import { sessionPopularityData } from "./analytics.mock";

export const SessionPopularityWidget = () => {
  return (
    <div className="widget-card">
      <h3>Session Popularity</h3>

      <ul>
        {sessionPopularityData.map((item) => (
          <li key={item.session}>
            <span>{item.session}</span>
            <strong>{item.views} views</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};