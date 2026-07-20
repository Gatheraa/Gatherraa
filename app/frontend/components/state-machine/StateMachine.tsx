import { useStateMachine } from "../../hooks/useStateMachine";
import { StateVisualizer } from "./StateVisualizer";
import { TransitionButtons } from "./TransitionButtons";
import { StateHistory } from "./StateHistory";

const config = {
  initialState: "Draft",

  transitions: {
    Draft: ["Review"],
    Review: ["Approved", "Rejected"],
    Approved: ["Published"],
    Rejected: ["Draft"],
    Published: [],
  },
};

export function StateMachine() {
  const {
    currentState,
    transition,
    history,
    availableTransitions,
  } = useStateMachine(config);

  return (
    <div className="space-y-6">
      <StateVisualizer
        currentState={currentState}
      />

      <TransitionButtons
        transitions={availableTransitions}
        onTransition={transition}
      />

      <StateHistory history={history} />
    </div>
  );
}