import { apiGet } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AttendeeRole =
  | 'attendee'
  | 'speaker'
  | 'organizer'
  | 'sponsor'
  | 'volunteer';

export type AttendeeStatus = 'registered' | 'checked-in' | 'waitlisted' | 'cancelled';

export interface Attendee {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: AttendeeRole;
  status: AttendeeStatus;
  bio?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  website?: string;
  twitterHandle?: string;
  githubHandle?: string;
  linkedinUrl?: string;
  interests?: string[];
  eventsAttended: number;
  isVerified: boolean;
  joinedAt: string;
  /** Wallet address (optional – web3 users only) */
  walletAddress?: string;
}

export interface AttendeeFilters {
  searchQuery?: string;
  role?: AttendeeRole | '';
  status?: AttendeeStatus | '';
  location?: string;
  hasWebsite?: boolean;
  isVerified?: boolean;
  interests?: string[];
  sortBy?: 'name' | 'eventsAttended' | 'joinedAt';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface AttendeeListResponse {
  attendees: Attendee[];
  total: number;
}

// ─── Mock data (until API endpoint is live) ──────────────────────────────────

const INTERESTS_POOL = [
  'Web3',
  'DeFi',
  'NFTs',
  'AI/ML',
  'DevOps',
  'React',
  'Design',
  'Sustainability',
  'Gaming',
  'DAO Governance',
  'Solidity',
  'Zero Knowledge',
];

const LOCATIONS = [
  'San Francisco, CA',
  'New York, NY',
  'London, UK',
  'Berlin, Germany',
  'Singapore',
  'Toronto, CA',
  'Tokyo, Japan',
  'Sydney, AU',
  'Remote',
];

const COMPANIES = [
  'Ethereum Foundation',
  'Polygon Labs',
  'Uniswap Labs',
  'OpenSea',
  'Chainlink',
  'Alchemy',
  'ConsenSys',
  'Figma',
  'GitHub',
  'Vercel',
  'Freelance',
];

const TITLES = [
  'Software Engineer',
  'Smart Contract Developer',
  'Product Manager',
  'UX Designer',
  'DevRel Engineer',
  'Protocol Researcher',
  'Marketing Lead',
  'Community Manager',
  'CTO',
  'Founder',
];

const ROLES: AttendeeRole[] = ['attendee', 'speaker', 'organizer', 'sponsor', 'volunteer'];
const STATUSES: AttendeeStatus[] = ['registered', 'checked-in', 'waitlisted', 'cancelled'];

const FIRST_NAMES = [
  'Alex','Jordan','Taylor','Morgan','Casey','Riley','Avery','Quinn',
  'Sage','Drew','Blake','Peyton','Reese','Skyler','Cameron','Dakota',
  'Emery','Finley','Harley','Indigo','Jesse','Kendall','Logan','Marlowe',
  'Noel','Oakley','Parker','Remy','Scout','Toby','Uma','Valor',
];
const LAST_NAMES = [
  'Kim','Patel','Nguyen','Williams','Chen','Rodriguez','Okafor','Müller',
  'Santos','Ivanova','Suzuki','Ali','Andersen','Beck','Cruz','Diaz',
  'Evans','Foster','Gray','Hall','Iyer','Johansson','Khan','Lee',
];

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seededRand(seed) * arr.length)];
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(seededRand(seed + i) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateMockAttendees(count: number = 120): Attendee[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = (i + 1) * 7919;
    const firstName = pick(FIRST_NAMES, seed);
    const lastName = pick(LAST_NAMES, seed + 1);
    const displayName = `${firstName} ${lastName}`;
    const slug = displayName.toLowerCase().replace(/\s+/g, '.');
    const interestCount = 2 + Math.floor(seededRand(seed + 3) * 4);
    const interests = shuffle(INTERESTS_POOL, seed).slice(0, interestCount);
    const avatarSeed = Math.floor(seededRand(seed + 99) * 9999);

    return {
      id: `attendee-${i + 1}`,
      displayName,
      email: `${slug}@example.com`,
      avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
      role: pick(ROLES, seed + 5),
      status: pick(STATUSES, seed + 6),
      bio:
        seededRand(seed + 7) > 0.35
          ? `Passionate about ${interests[0]} and ${interests[1]}. Building the future of the web, one block at a time.`
          : undefined,
      company: seededRand(seed + 8) > 0.2 ? pick(COMPANIES, seed + 8) : undefined,
      jobTitle: seededRand(seed + 9) > 0.25 ? pick(TITLES, seed + 9) : undefined,
      location: seededRand(seed + 10) > 0.15 ? pick(LOCATIONS, seed + 10) : undefined,
      website:
        seededRand(seed + 11) > 0.6 ? `https://${slug.replace('.', '-')}.dev` : undefined,
      twitterHandle: seededRand(seed + 12) > 0.5 ? `@${firstName.toLowerCase()}` : undefined,
      githubHandle: seededRand(seed + 13) > 0.45 ? `${firstName.toLowerCase()}-dev` : undefined,
      linkedinUrl:
        seededRand(seed + 14) > 0.55 ? `https://linkedin.com/in/${slug}` : undefined,
      interests,
      eventsAttended: Math.floor(seededRand(seed + 15) * 32),
      isVerified: seededRand(seed + 16) > 0.6,
      joinedAt: new Date(
        Date.now() - Math.floor(seededRand(seed + 17) * 365 * 2 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      walletAddress:
        seededRand(seed + 18) > 0.55
          ? `0x${Array.from({ length: 40 }, (_, k) =>
              Math.floor(seededRand(seed + 18 + k) * 16).toString(16),
            ).join('')}`
          : undefined,
    };
  });
}

// ─── API client ──────────────────────────────────────────────────────────────

const ALL_MOCK_ATTENDEES = generateMockAttendees(120);

export const attendeesApi = {
  /**
   * Fetch a paginated, filtered list of attendees.
   * Falls back to deterministic mock data when the API endpoint is unavailable.
   */
  searchAttendees: async (
    filters: AttendeeFilters,
  ): Promise<AttendeeListResponse> => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v));
          } else {
            params.append(key, String(value));
          }
        }
      });
      return await apiGet<AttendeeListResponse>(
        `/attendees/search?${params.toString()}`,
      );
    } catch {
      // ── Offline / mock fallback ─────────────────────────────────────────
      return simulateMockSearch(filters);
    }
  },

  getAttendee: async (id: string): Promise<Attendee> => {
    try {
      return await apiGet<Attendee>(`/attendees/${id}`);
    } catch {
      const found = ALL_MOCK_ATTENDEES.find((a) => a.id === id);
      if (!found) throw new Error('Attendee not found');
      return found;
    }
  },
};

function simulateMockSearch(filters: AttendeeFilters): AttendeeListResponse {
  const {
    searchQuery,
    role,
    status,
    location,
    isVerified,
    sortBy = 'name',
    sortOrder = 'ASC',
    limit = 12,
    offset = 0,
  } = filters;

  let results = [...ALL_MOCK_ATTENDEES];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    results = results.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.company?.toLowerCase().includes(q) ||
        a.jobTitle?.toLowerCase().includes(q) ||
        a.bio?.toLowerCase().includes(q) ||
        a.interests?.some((i) => i.toLowerCase().includes(q)),
    );
  }
  if (role) results = results.filter((a) => a.role === role);
  if (status) results = results.filter((a) => a.status === status);
  if (location) {
    const loc = location.toLowerCase();
    results = results.filter((a) => a.location?.toLowerCase().includes(loc));
  }
  if (isVerified !== undefined) {
    results = results.filter((a) => a.isVerified === isVerified);
  }

  results.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.displayName.localeCompare(b.displayName);
    else if (sortBy === 'eventsAttended') cmp = a.eventsAttended - b.eventsAttended;
    else if (sortBy === 'joinedAt')
      cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    return sortOrder === 'DESC' ? -cmp : cmp;
  });

  const total = results.length;
  return { attendees: results.slice(offset, offset + limit), total };
}
