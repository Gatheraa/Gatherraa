import {
  useEffect,
  useRef,
  useState,
} from "react";

interface Organizer {
  id: string;
  name: string;
  color: string;
}

interface ScheduleItem {
  id: string;
  title: string;
  start: string;
  end: string;
}

interface CursorPosition {
  userId: string;
  x: number;
  y: number;
}

interface Props {
  initialSchedule: ScheduleItem[];
  organizers: Organizer[];

  onSave?(schedule: ScheduleItem[]): Promise<void>;

  onPresenceChange?(userId: string): void;

  onCursorMove?(cursor: CursorPosition): void;

  onConflict?(
    local: ScheduleItem[],
    remote: ScheduleItem[]
  ): ScheduleItem[];
}

export function CollaborativeScheduleEditor({
  initialSchedule,
  organizers,
  onSave,
  onPresenceChange,
  onCursorMove,
  onConflict,
}: Props) {
  const [schedule, setSchedule] =
    useState(initialSchedule);

  const [saving, setSaving] =
    useState(false);

  const [lastSaved, setLastSaved] =
    useState<Date>();

  const [activeUsers, setActiveUsers] =
    useState(organizers);

  const [cursor, setCursor] =
    useState<CursorPosition[]>([]);

  const timeout =
    useRef<NodeJS.Timeout>();

  /*
   * Presence
   */

  useEffect(() => {
    activeUsers.forEach(user => {
      onPresenceChange?.(user.id);
    });
  }, []);

  /*
   * Cursor awareness
   */

  useEffect(() => {

    function move(e: MouseEvent) {

      const current = {
        userId: "me",
        x: e.clientX,
        y: e.clientY,
      };

      onCursorMove?.(current);

      setCursor([
        current,
      ]);

    }

    window.addEventListener(
      "mousemove",
      move
    );

    return () =>
      window.removeEventListener(
        "mousemove",
        move
      );

  }, []);

  /*
   * Autosave
   */

  useEffect(() => {

    clearTimeout(timeout.current);

    timeout.current = setTimeout(
      async () => {

        if (!onSave) return;

        setSaving(true);

        await onSave(schedule);

        setSaving(false);

        setLastSaved(
          new Date()
        );

      },
      2000
    );

    return () =>
      clearTimeout(
        timeout.current
      );

  }, [schedule]);

  /*
   * Optimistic Update
   */

  function updateTitle(
    id: string,
    title: string
  ) {

    setSchedule(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              title,
            }
          : item
      )
    );

  }

  /*
   * Conflict Resolution
   */

  function resolveConflict(
    remote: ScheduleItem[]
  ) {

    if (!onConflict) return;

    const merged =
      onConflict(
        schedule,
        remote
      );

    setSchedule(
      merged
    );

  }

  return (
    <div className="space-y-6">

      {/* Presence */}

      <div className="flex gap-2">

        {activeUsers.map(user => (

          <div
            key={user.id}
            className="flex items-center gap-2"
          >

            <span
              className="h-3 w-3 rounded-full"
              style={{
                background: user.color,
              }}
            />

            {user.name}

          </div>

        ))}

      </div>

      {/* Editor */}

      <div className="space-y-3">

        {schedule.map(item => (

          <div
            key={item.id}
            className="rounded border p-4"
          >

            <input
              value={item.title}
              className="w-full border p-2"
              onChange={e =>
                updateTitle(
                  item.id,
                  e.target.value
                )
              }
            />

            <div className="mt-2 text-sm">

              {item.start}
              {" - "}
              {item.end}

            </div>

          </div>

        ))}

      </div>

      {/* Cursor */}

      {cursor.map(c => (

        <div
          key={c.userId}
          className="pointer-events-none fixed text-xs"

          style={{
            left: c.x,
            top: c.y,
          }}
        >

          🖱

        </div>

      ))}

      {/* Footer */}

      <div className="flex justify-between text-sm">

        <span>

          {saving
            ? "Saving..."
            : "Saved"}

        </span>

        <span>

          {lastSaved
            ? lastSaved.toLocaleTimeString()
            : ""}

        </span>

      </div>

      {/* Simulate Conflict */}

      <button
        onClick={() =>
          resolveConflict(schedule)
        }
      >
        Resolve Conflict
      </button>

    </div>
  );
}