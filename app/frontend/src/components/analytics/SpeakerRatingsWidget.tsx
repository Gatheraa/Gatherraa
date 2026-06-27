import { speakerRatingsData } from "./analytics.mock";

export const SpeakerRatingsWidget = () => {
  return (
    <div className="widget-card">
      <h3>Speaker Ratings</h3>

      <ul>
        {speakerRatingsData.map((speaker) => (
          <li key={speaker.speaker}>
            <span>{speaker.speaker}</span>
            <strong>⭐ {speaker.rating}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};