interface Props {
  currentState: string;
}

export function StateVisualizer({
  currentState,
}: Props) {
  return (
    <div className="rounded-md border p-4">
      <h3>Current State</h3>

      <span className="font-bold">
        {currentState}
      </span>
    </div>
  );
}