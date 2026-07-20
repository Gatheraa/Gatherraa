import {
  toMinutes,
  durationToMinutes,
  detectCollisions,
  moveSession,
  pushHistory,
  undo,
  redo,
  arraysEqual,
} from "./dragDropLogic.ts";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}`);
  }
}

// --- toMinutes / duration ---
check("09:00 AM -> 540", toMinutes("09:00 AM") === 540);
check("01:30 PM -> 810", toMinutes("01:30 PM") === 810);
check("13:30 -> 810 (24h)", toMinutes("13:30") === 810);
check("12:00 AM -> 0", toMinutes("12:00 AM") === 0);
check("garbage -> null", toMinutes("noon") === null);
check("45 min -> 45", durationToMinutes("45 min") === 45);
check("1h -> 60", durationToMinutes("1h") === 60);

// --- collisions ---
const noCollision = detectCollisions([
  { id: "1", time: "09:00 AM", duration: "30 min" },
  { id: "2", time: "10:00 AM", duration: "30 min" },
]);
check("no collision when separated", noCollision.length === 0);

const withCollision = detectCollisions([
  { id: "1", time: "09:00 AM", duration: "60 min" },
  { id: "2", time: "09:30 AM", duration: "60 min" },
]);
check("overlap detected (30 min)", withCollision.length === 1 && withCollision[0].overlapMinutes === 30);

const untimed = detectCollisions([
  { id: "1", title: "x" },
  { id: "2", title: "y" },
]);
check("untimed sessions -> no collisions", untimed.length === 0);

// --- moveSession ---
const arr = [
  { id: "1" },
  { id: "2" },
  { id: "3" },
] as any[];
const moved = moveSession(arr, 0, 2);
check("move 0->2 reorders", moved[2].id === "1" && moved[0].id === "2");
check("move is immutable", arr[0].id === "1" && moved !== arr);
check("move out-of-range returns same ref", moveSession(arr, 0, 99) === arr);
check("move same index returns same ref", moveSession(arr, 1, 1) === arr);

// --- history (undo/redo) ---
let h = { past: [] as any[][], present: ["a"], future: [] as any[][] };
h = pushHistory(h, ["a", "b"]);
check("pushHistory adds to past", h.past.length === 1 && h.present.length === 2);
h = pushHistory(h, ["a", "b"]); // no-op when equal
check("pushHistory no-op on equal", h.past.length === 1);
h = undo(h);
check("undo restores present", h.present.length === 1 && h.present[0] === "a");
h = redo(h);
check("redo restores present", h.present.length === 2 && h.present[1] === "b");

// --- arraysEqual ---
check("arraysEqual true", arraysEqual(["a", "b"], ["a", "b"]));
check("arraysEqual false len", !arraysEqual(["a"], ["a", "b"]));
check("arraysEqual false val", !arraysEqual(["a"], ["b"]));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
