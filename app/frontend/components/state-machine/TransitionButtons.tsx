interface Props {
  transitions: string[];
  onTransition(state: string): void;
}

export function TransitionButtons({
  transitions,
  onTransition,
}: Props) {
  return (
    <div className="flex gap-2">
      {transitions.map((state) => (
        <button
          key={state}
          onClick={() => onTransition(state)}
        >
          {state}
        </button>
      ))}
    </div>
  );
}