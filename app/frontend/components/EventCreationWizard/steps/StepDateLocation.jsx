import React from "react";

export default function StepDateLocation({ data, onChange, errors }) {
  return (
    <div>
      <h2>Date & Location</h2>

      <input
        type="date"
        value={data.date || ""}
        onChange={(e) => onChange("date", e.target.value)}
      />
      {errors.date && <p style={{ color: "red" }}>{errors.date}</p>}

      <input
        type="text"
        placeholder="Location"
        value={data.location || ""}
        onChange={(e) => onChange("location", e.target.value)}
      />
      {errors.location && (
        <p style={{ color: "red" }}>{errors.location}</p>
      )}
    </div>
  );
}