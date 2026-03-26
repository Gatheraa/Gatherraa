import React from "react";

export default function StepReview({ data }) {
  return (
    <div>
      <h2>Review</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}