import { useMemo, useState } from "react";
import {
  HistoryEntry,
  StateMachineConfig,
} from "../types/stateMachine";

export function useStateMachine(config: StateMachineConfig) {
  const [currentState, setCurrentState] = useState(
    config.initialState
  );

  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      state: config.initialState,
      timestamp: new Date(),
    },
  ]);

  const availableTransitions = useMemo(
    () => config.transitions[currentState] ?? [],
    [config.transitions, currentState]
  );

  function transition(nextState: string) {
    if (!availableTransitions.includes(nextState)) {
      return false;
    }

    setCurrentState(nextState);

    setHistory((prev) => [
      ...prev,
      {
        state: nextState,
        timestamp: new Date(),
      },
    ]);

    return true;
  }

  return {
    currentState,
    availableTransitions,
    transition,
    history,
  };
}