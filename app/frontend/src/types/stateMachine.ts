export interface TransitionMap {
  [state: string]: string[];
}

export interface HistoryEntry {
  state: string;
  timestamp: Date;
}

export interface StateMachineConfig {
  initialState: string;
  transitions: TransitionMap;
}