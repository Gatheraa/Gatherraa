// Pure, framework-free logic for DragDropScheduleBoard.
// Kept dependency-free so it is unit-testable without React/install.

export interface BoardSession {
  id: string;
  title: string;
  time?: string;
  duration?: string;
  location?: string;
  speaker?: string;
  type?: 'workshop' | 'keynote' | 'break' | 'networking';
}

export interface Collision {
  a: string;
  b: string;
  overlapMinutes: number;
  reason: string;
}

/** Parse "09:00 AM" / "13:30" -> minutes since midnight, or null if unparseable. */
export function toMinutes(time: string): number | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3] ? m[3].toUpperCase() : null;
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Parse "45 min" / "1h" -> minutes, or null. */
export function durationToMinutes(d: string): number | null {
  const min = d.trim().match(/(\d+)\s*min/i);
  if (min) return parseInt(min[1], 10);
  const hr = d.trim().match(/(\d+)\s*h/i);
  if (hr) return parseInt(hr[1], 10) * 60;
  return null;
}

/** Detect time-overlap collisions between sessions that have time+duration. */
export function detectCollisions(sessions: BoardSession[]): Collision[] {
  const timed = sessions
    .map((s) => {
      const start = s.time ? toMinutes(s.time) : null;
      const dur = s.duration ? durationToMinutes(s.duration) : null;
      return { id: s.id, start, end: start !== null && dur !== null ? start + dur : null };
    })
    .filter((s): s is { id: string; start: number; end: number } => s.start !== null && s.end !== null);

  const collisions: Collision[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlap > 0) {
        collisions.push({
          a: a.id,
          b: b.id,
          overlapMinutes: overlap,
          reason: `Sessions overlap by ${overlap} min`,
        });
      }
    }
  }
  return collisions;
}

/** Immutably move a session from one index to another. */
export function moveSession(
  sessions: BoardSession[],
  fromIndex: number,
  toIndex: number,
): BoardSession[] {
  if (
    fromIndex < 0 ||
    fromIndex >= sessions.length ||
    toIndex < 0 ||
    toIndex >= sessions.length ||
    fromIndex === toIndex
  ) {
    return sessions;
  }
  const next = sessions.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export interface HistoryState<T> {
  past: T[][];
  present: T[];
  future: T[][];
}

export function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** Push a new present onto history, pruning an over-long past. */
export function pushHistory<T>(
  state: HistoryState<T>,
  next: T[],
  limit = 50,
): HistoryState<T> {
  if (arraysEqual(state.present as unknown[], next as unknown[])) return state;
  const past = [...state.past, state.present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
  };
}

export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}
