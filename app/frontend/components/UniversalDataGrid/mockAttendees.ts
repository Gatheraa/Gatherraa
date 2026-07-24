import type { UniversalDataGridColumn } from "./types";

export interface Attendee {
  id: string;
  name: string;
  email: string;
  ticketType: string;
  status: string;
  registeredAt: string;
  checkedIn: boolean;
}

const FIRST_NAMES = [
  "Ada", "Liam", "Maya", "Noah", "Zara", "Kofi", "Elena", "Ravi",
  "Sofia", "Tariq", "Yuki", "Diego", "Nina", "Omar", "Ines", "Kwame",
];
const LAST_NAMES = [
  "Okafor", "Chen", "Silva", "Andersson", "Patel", "Mensah", "Ivanova",
  "Garcia", "Kowalski", "Nakamura", "Haddad", "Oduya", "Novak", "Reyes",
];
const TICKET_TYPES = ["General", "VIP", "Speaker", "Sponsor", "Volunteer"];
const STATUSES = ["Confirmed", "Pending", "Cancelled"];

function deterministicPick<T>(list: T[], seed: number): T {
  return list[seed % list.length];
}

export function generateAttendees(count: number): Attendee[] {
  const rows: Attendee[] = [];
  for (let i = 0; i < count; i++) {
    const first = deterministicPick(FIRST_NAMES, i);
    const last = deterministicPick(LAST_NAMES, i * 7 + 3);
    const ticketType = deterministicPick(TICKET_TYPES, i * 3 + 1);
    const status = deterministicPick(STATUSES, i * 5 + 2);
    const dayOffset = i % 60;
    const registeredAt = new Date(2026, 4, 1 + dayOffset)
      .toISOString()
      .slice(0, 10);

    rows.push({
      id: `attendee-${i + 1}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      ticketType,
      status,
      registeredAt,
      checkedIn: i % 3 === 0,
    });
  }
  return rows;
}

export const DEFAULT_ATTENDEES: Attendee[] = generateAttendees(5000);

export const ATTENDEE_COLUMNS: UniversalDataGridColumn<Attendee>[] = [
  { id: "name", header: "Name", accessor: (row) => row.name, width: 180 },
  { id: "email", header: "Email", accessor: (row) => row.email, width: 240 },
  {
    id: "ticketType",
    header: "Ticket Type",
    accessor: (row) => row.ticketType,
    width: 140,
  },
  { id: "status", header: "Status", accessor: (row) => row.status, width: 130 },
  {
    id: "registeredAt",
    header: "Registered",
    accessor: (row) => row.registeredAt,
    width: 130,
  },
  {
    id: "checkedIn",
    header: "Checked In",
    accessor: (row) => (row.checkedIn ? "Yes" : "No"),
    width: 110,
  },
];
