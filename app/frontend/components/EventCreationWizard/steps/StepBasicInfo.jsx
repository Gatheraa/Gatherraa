import React from "react";

export default function StepBasicInfo({ data, onChange, errors }) {
  return (
    <div>
      <h2>Basic Info</h2>

      <input
        type="text"
        placeholder="Event Title"
        value={data.title || ""}
        onChange={(e) => onChange("title", e.target.value)}
      />
      {errors.title && <p style={{ color: "red" }}>{errors.title}</p>}

      <textarea
        placeholder="Description"
        value={data.description || ""}
        onChange={(e) => onChange("description", e.target.value)}
      />
      {errors.description && (
        <p style={{ color: "red" }}>{errors.description}</p>
      )}
    </div>
  );
}