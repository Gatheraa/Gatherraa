# Attendee Discovery Interface

A comprehensive interface for discovering and browsing event attendees with advanced search, filtering, and pagination capabilities.

## Components

### 1. **AttendeeDiscovery** (Main Component)
The primary component that orchestrates all attendee discovery features.

**Features:**
- 🔍 Full-text search across names, titles, bios, skills, and interests
- 🎯 Advanced filtering by experience level, interests, skills, ratings, and verification status
- 📱 Responsive design with mobile-optimized filter sidebar
- 📄 Configurable pagination with customizable page sizes
- ⚡ Debounced search for performance optimization
- 🎨 Clean, modern UI with loading and empty states

**Props:**
```typescript
interface AttendeeDiscoveryProps {
  // Core data
  attendees: Attendee[];
  loading?: boolean;
  
  // Search and placeholder
  searchPlaceholder?: string;
  
  // Pagination configuration
  defaultPageSize?: number; // Default: 12
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[]; // Default: [12, 24, 48]
  
  // Available options for filters
  availableSkills?: string[];
  availableInterests?: string[];
  
  // Event callbacks
  onConnect?: (attendeeId: string) => void;
  onViewProfile?: (attendeeId: string) => void;
  onSearch?: (query: string) => void;
  onFiltersChange?: (filters: AttendeeFilters) => void;
  
  // UI customization
  emptyMessage?: string;
  className?: string;
}
```

**Usage:**
```typescript
import { AttendeeDiscovery } from '@/components/attendees';

export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const handleConnect = (attendeeId: string) => {
    // Handle connection logic
    console.log('Connect with:', attendeeId);
  };

  return (
    <AttendeeDiscovery
      attendees={attendees}
      onConnect={handleConnect}
      onViewProfile={(id) => console.log('View:', id)}
    />
  );
}
```

---

### 2. **AttendeeProfileCard**
Individual attendee profile card component displaying essential information.

**Features:**
- 👤 Avatar with initials fallback
- ✅ Verification badge
- ⭐ Rating display with star visualization
- 📊 Attendance count and badges statistics
- 🏷️ Interests and skills with badges
- 🔗 Social media links (Twitter, LinkedIn, GitHub)
- 🎯 Action buttons (Connect, View Profile, Website)

**Props:**
```typescript
interface AttendeeProfileCardProps {
  attendee: Attendee;
  onConnect?: (attendeeId: string) => void;
  onView?: (attendeeId: string) => void;
  className?: string;
}
```

**Usage:**
```typescript
import { AttendeeProfileCard } from '@/components/attendees';

<AttendeeProfileCard
  attendee={attendeeData}
  onConnect={(id) => handleConnect(id)}
  onView={(id) => navigateToProfile(id)}
/>
```

---

### 3. **AttendeeFilters**
Expandable filter panel with multiple filter options.

**Filter Options:**
- 🎓 Experience Level (Beginner, Intermediate, Advanced, Expert)
- ⭐ Minimum Rating (1-5 stars)
- 💡 Interests (multi-select)
- 🛠️ Skills (multi-select)
- ✅ Verification Status
- 📍 Location
- 📊 Attendance Range

**Props:**
```typescript
interface AttendeeFiltersProps {
  availableSkills: string[];
  availableInterests: string[];
  filters: AttendeeFilters;
  onFilterChange: (filters: AttendeeFilters) => void;
  onClearFilters: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}
```

**Usage:**
```typescript
import { AttendeeFilters } from '@/components/attendees';

<AttendeeFilters
  availableSkills={skills}
  availableInterests={interests}
  filters={activeFilters}
  onFilterChange={setFilters}
  onClearFilters={() => setFilters({})}
/>
```

---

### 4. **Pagination**
Reusable pagination component for navigating through pages.

**Features:**
- ⬅️ Previous/Next page navigation
- 🎯 Direct page number selection
- ⏪ First/Last page buttons
- 📊 Results info display
- 🔧 Optional page size selector
- ♿ Full accessibility support

**Props:**
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  maxButtons?: number; // Default: 5
  className?: string;
}
```

**Usage:**
```typescript
import { Pagination } from '@/components/attendees';

<Pagination
  currentPage={1}
  totalPages={10}
  totalItems={120}
  pageSize={12}
  onPageChange={(page) => setPage(page)}
/>
```

---

## Types

All type definitions are in `/types/attendee.ts`:

```typescript
interface Attendee {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  bio?: string;
  interests: string[];
  skills: string[];
  experience?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  location?: string;
  verified: boolean;
  attendanceCount: number;
  rating: number; // 0-5
  badges: string[];
  joinedAt: string | Date;
  website?: string;
  social?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

interface AttendeeFilters {
  experience?: Attendee['experience'][];
  interests?: string[];
  skills?: string[];
  verified?: boolean;
  minRating?: number;
  location?: string;
  attendanceRange?: {
    min: number;
    max: number;
  };
}
```

---

## Hooks

### usePagination
Custom hook for managing pagination state.

```typescript
const pagination = usePagination({
  initialPage: 1,
  initialPageSize: 12,
  total: 120,
});

// Returns:
{
  currentPage: number;
  pageSize: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}
```

---

## Integration Examples

### Basic Setup
```typescript
import { AttendeeDiscovery } from '@/components/attendees';
import { Attendee } from '@/types/attendee';
import { useState, useEffect } from 'react';

export default function AttendeesDiscoveryPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch attendees
    fetchAttendees().then((data) => {
      setAttendees(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6">
      <AttendeeDiscovery
        attendees={attendees}
        loading={loading}
        defaultPageSize={12}
        onConnect={(id) => handleConnect(id)}
        onViewProfile={(id) => handleViewProfile(id)}
      />
    </div>
  );
}
```

### With API Search
```typescript
export default function SearchableAttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setLoading(true);
    const results = await searchAttendees(query);
    setAttendees(results);
    setLoading(false);
  };

  const handleFiltersChange = async (filters: AttendeeFilters) => {
    setLoading(true);
    const results = await filterAttendees(filters);
    setAttendees(results);
    setLoading(false);
  };

  return (
    <AttendeeDiscovery
      attendees={attendees}
      loading={loading}
      onSearch={handleSearch}
      onFiltersChange={handleFiltersChange}
      showPageSizeSelector={true}
    />
  );
}
```

---

## Styling

All components use CSS variables for theming:
- `--surface`: Card background
- `--shadow-sm`: Small shadow
- `--border-default`: Default border color

### Custom CSS
```css
/* Override card styles */
:root {
  --surface: #ffffff;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --border-default: #e5e7eb;
}

/* Custom attendee card styling */
.attendee-profile-card {
  /* Your custom styles */
}
```

---

## Accessibility

All components include:
- ♿ ARIA labels and roles
- ⌨️ Keyboard navigation support
- 🎯 Focus management
- 📢 Screen reader friendly
- 🔍 Semantic HTML

---

## Performance Optimization

- ⚡ Debounced search input (300ms default)
- 📦 Lazy loading with pagination
- 🎨 CSS animations for smooth transitions
- 🔄 Memoized filtered results
- 📄 Configurable page sizes for optimal performance

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile and desktop
- Progressive enhancement

---

## Future Enhancements

Potential additions:
- [ ] Saved filters and search history
- [ ] Advanced sorting options
- [ ] Attendee comparison feature
- [ ] Export attendee data
- [ ] Bulk actions
- [ ] Analytics integration
- [ ] Real-time updates
