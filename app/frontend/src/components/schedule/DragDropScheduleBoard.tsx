"use client";

import React, { useState, useCallback, useMemo, useReducer } from "react";
import { Reorder, useDragControls, motion } from "framer-motion";
import { GripVertical, AlertTriangle, Undo2, Redo2 } from "lucide-react";
import {
  BoardSession,
  Collision,
  detectCollisions,
  moveSession,
  HistoryState,
  pushHistory,
  undo,
  redo,
} from "./dragDropLogic";

export interface DragDropScheduleBoardProps {
  initialSessions?: BoardSession[];
  onReorder?: (sessions: BoardSession[]) => void;
  onChange?: (sessions: BoardSession[], collisions: Collision[]) => void;
  className?: string;
}

interface State {
  history: HistoryState<BoardSession>;
}

type Action =
  | { type: "SET"; sessions: BoardSession[] }
  | { type: "UNDO" }
  | { type: "REDO" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET":
      return { history: pushHistory(state.history, action.sessions) };
    case "UNDO":
      return { history: undo(state.history) };
    case "REDO":
      return { history: redo(state.history) };
    default:
      return state;
  }
}

function Row({
  session,
  onDragEnd,
}: {
  session: BoardSession;
  onDragEnd: (from: number, to: number) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={session}
      dragListener={false}
      dragControls={controls}
      onDragEnd={(_, info) => {
        // framer Reorder handles reorder by value; we recompute index via onChange.
      }}
      className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
    >
      <button
        aria-label="Drag handle"
        className="cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={16} className="text-zinc-500" />
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{session.title}</div>
        <div className="text-xs text-zinc-400">
          {[session.time, session.duration, session.location]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    </Reorder.Item>
  );
}

export const DragDropScheduleBoard: React.FC<DragDropScheduleBoardProps> = ({
  initialSessions = [],
  onReorder,
  onChange,
  className = "",
}) => {
  const [state, dispatch] = useReducer(reducer, {
    history: { past: [], present: initialSessions, future: [] },
  });
  const sessions = state.history.present;

  const collisions = useMemo(() => detectCollisions(sessions), [sessions]);

  const setSessions = useCallback(
    (next: BoardSession[]) => {
      dispatch({ type: "SET", sessions: next });
      onReorder?.(next);
      onChange?.(next, detectCollisions(next));
    },
    [onReorder, onChange],
  );

  const handleReorder = useCallback(
    (next: BoardSession[]) => setSessions(next),
    [setSessions],
  );

  const move = useCallback(
    (from: number, to: number) =>
      setSessions(moveSession(sessions, from, to)),
    [sessions, setSessions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        move(index, index - 1);
      } else if (e.key === "ArrowDown" && index < sessions.length - 1) {
        e.preventDefault();
        move(index, index + 1);
      }
    },
    [move, sessions.length],
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {sessions.length} session(s)
        </span>
        <div className="flex gap-1">
          <button
            aria-label="Undo"
            disabled={state.history.past.length === 0}
            onClick={() => dispatch({ type: "UNDO" })}
            className="rounded bg-zinc-800 p-1 text-zinc-300 disabled:opacity-30"
          >
            <Undo2 size={14} />
          </button>
          <button
            aria-label="Redo"
            disabled={state.history.future.length === 0}
            onClick={() => dispatch({ type: "REDO" })}
            className="rounded bg-zinc-800 p-1 text-zinc-300 disabled:opacity-30"
          >
            <Redo2 size={14} />
          </button>
        </div>
      </div>

      {collisions.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300"
        >
          <AlertTriangle size={14} />
          {collisions.length} time collision(s) detected
        </div>
      )}

      <Reorder.Group axis="y" values={sessions} onReorder={handleReorder}>
        {sessions.map((session, i) => (
          <div
            key={session.id}
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="outline-none"
          >
            <Row session={session} onDragEnd={() => {}} />
          </div>
        ))}
      </Reorder.Group>
    </div>
  );
};

export default DragDropScheduleBoard;
