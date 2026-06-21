# Attendee Discovery Interface - Implementation Guide

## Overview

This guide provides step-by-step instructions for integrating the Attendee Discovery Interface into your application, including frontend components, backend API requirements, and database considerations.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Component Architecture](#component-architecture)
3. [Backend API Requirements](#backend-api-requirements)
4. [Database Schema](#database-schema)
5. [Implementation Steps](#implementation-steps)
6. [Advanced Integration](#advanced-integration)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Installation

All components are already created in `/components/attendees/`:

```bash
# Components are ready to use - no installation needed
# Just import and use in your pages
```

### Basic Usage

```typescript
'use client';

import { AttendeeDiscovery } from '@/components/attendees';
import { useState, useEffect } from 'react';
import type { Attendee } from '@/types/attendee';

export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  useEffect(() => {
    // Fetch attendees from your API
    fetch('/api/attendees')
      .then(res => res.json())
      .then(data => setAttendees(data));
  }, []);

  return (
    <div className="container mx-auto p-4">
      <AttendeeDiscovery attendees={attendees} />
    </div>
  );
}
```

---

## Component Architecture

```
AttendeeDiscovery (Main Container)
├── SearchInput (Search bar)
├── AttendeeFilters (Sidebar filters)
│   ├── Experience Level Filter
│   ├── Rating Filter
│   ├── Interests Filter
│   ├── Skills Filter
│   └── Verification Filter
├── AttendeeProfileCard (Grid)
│   ├── Avatar Section
│   ├── Rating Display
│   ├── Bio & Info
│   ├── Stats
│   ├── Interests & Skills
│   └── Action Buttons
└── Pagination
    ├── Page Number Buttons
    ├── Navigation Buttons
    └── Results Info
```

### Component Dependencies

```
AttendeeDiscovery
├── SearchInput (from /ui/atoms)
├── Button (from /ui/atoms)
├── Text (from /ui/atoms)
├── Spinner (from /ui/atoms)
├── AttendeeProfileCard
│   ├── Card (from /ui/molecules)
│   ├── Badge (from /ui/atoms)
│   ├── Button (from /ui/atoms)
│   └── Text (from /ui/atoms)
├── AttendeeFilters
│   ├── Card (from /ui/molecules)
│   ├── Button (from /ui/atoms)
│   ├── Badge (from /ui/atoms)
│   └── Text (from /ui/atoms)
├── Pagination
│   ├── Button (from /ui/atoms)
│   └── Text (from /ui/atoms)
└── usePagination (custom hook)
```

---

## Backend API Requirements

### 1. GET /api/attendees

Fetch paginated list of attendees with optional filters.

**Request Query Parameters:**

```typescript
{
  // Pagination
  page?: number;              // 1-indexed, default: 1
  pageSize?: number;          // default: 12
  
  // Search
  search?: string;            // Full-text search
  
  // Filters
  experience?: string;        // Comma-separated: beginner,intermediate,advanced,expert
  interests?: string;         // Comma-separated interest names
  skills?: string;            // Comma-separated skill names
  verified?: boolean;         // Show only verified attendees
  minRating?: number;         // Minimum rating (1-5)
  location?: string;          // Location filter
  minAttendance?: number;     // Minimum attendance count
  maxAttendance?: number;     // Maximum attendance count
  
  // Sorting
  sortBy?: string;            // 'name', 'rating', 'attendance', 'recent'
  sortOrder?: 'asc' | 'desc'; // default: 'asc'
}
```

**Response Format:**

```typescript
{
  attendees: Attendee[];
  pagination: {
    currentPage: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    experience?: string[];
    interests?: string[];
    skills?: string[];
    verified?: boolean;
    minRating?: number;
  };
}
```

**Example Request:**

```bash
GET /api/attendees?search=blockchain&experience=advanced,expert&minRating=4&page=1&pageSize=12
```

### 2. GET /api/attendees/:id

Get detailed attendee profile.

**Response:**

```typescript
{
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  bio?: string;
  interests: string[];
  skills: string[];
  experience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  location?: string;
  verified: boolean;
  attendanceCount: number;
  rating: number;
  badges: string[];
  joinedAt: string;
  website?: string;
  social?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
  // Additional fields
  email?: string;
  bio?: string;
  reviews?: Review[];
  stats?: {
    postsCount: number;
    connectionsCount: number;
    eventsHosted: number;
  };
}
```

### 3. POST /api/connections

Create a connection with another attendee.

**Request Body:**

```typescript
{
  attendeeId: string;
  message?: string; // Optional connection message
}
```

**Response:**

```typescript
{
  id: string;
  userId: string;
  attendeeId: string;
  status: 'pending' | 'connected' | 'blocked';
  createdAt: string;
}
```

### 4. GET /api/attendees/search

Advanced search endpoint (optional, for better performance).

**Request Query Parameters:**

```typescript
{
  q: string;      // Search query
  type?: string;  // 'name', 'skill', 'interest', 'all' (default)
  limit?: number; // default: 10
}
```

**Response:**

```typescript
{
  results: {
    attendees: Attendee[];
    skills: string[];
    interests: string[];
  };
}
```

---

## Database Schema

### Attendees Table

```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(512),
  
  -- Profile Information
  experience ENUM('beginner', 'intermediate', 'advanced', 'expert'),
  location VARCHAR(255),
  website VARCHAR(512),
  verified BOOLEAN DEFAULT FALSE,
  
  -- Social Links
  twitter_handle VARCHAR(255),
  linkedin_profile VARCHAR(255),
  github_username VARCHAR(255),
  
  -- Stats
  rating DECIMAL(3,2) DEFAULT 0,
  attendance_count INTEGER DEFAULT 0,
  
  -- Metadata
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_verified (verified),
  INDEX idx_rating (rating),
  INDEX idx_attendance (attendance_count),
  FULLTEXT INDEX idx_search (name, title, bio)
);
```

### Attendee Skills Junction Table

```sql
CREATE TABLE attendee_skills (
  attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  proficiency ENUM('beginner', 'intermediate', 'advanced', 'expert'),
  
  PRIMARY KEY (attendee_id, skill_id),
  INDEX idx_skill_id (skill_id)
);
```

### Attendee Interests Junction Table

```sql
CREATE TABLE attendee_interests (
  attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
  interest_id UUID REFERENCES interests(id) ON DELETE CASCADE,
  
  PRIMARY KEY (attendee_id, interest_id),
  INDEX idx_interest_id (interest_id)
);
```

### Attendee Badges Table

```sql
CREATE TABLE attendee_badges (
  attendee_id UUID REFERENCES attendees(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (attendee_id, badge_id)
);
```

### Skills and Interests Master Tables

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100),
  
  INDEX idx_name (name)
);

CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100),
  
  INDEX idx_name (name)
);

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(512),
  
  INDEX idx_name (name)
);
```

---

## Implementation Steps

### Step 1: Prepare Your Data

Ensure your database has attendee data with the required fields:

```typescript
// Required fields
- id: string
- name: string
- interests: string[]
- skills: string[]
- verified: boolean
- attendanceCount: number
- rating: number (0-5)
- badges: string[]
- joinedAt: Date

// Optional but recommended
- avatar?: string
- title?: string
- bio?: string
- experience?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
- location?: string
- website?: string
- social?: { twitter?, linkedin?, github? }
```

### Step 2: Create Backend Endpoint

Create your API endpoint at `/api/attendees`:

```typescript
// pages/api/attendees.ts (or app/api/attendees/route.ts for Next.js 13+)

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Parse query parameters
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '12');
  const search = searchParams.get('search') || '';
  const experience = searchParams.get('experience')?.split(',') || [];
  const interests = searchParams.get('interests')?.split(',') || [];
  const skills = searchParams.get('skills')?.split(',') || [];
  const verified = searchParams.get('verified') === 'true';
  const minRating = searchParams.get('minRating') ? 
    parseFloat(searchParams.get('minRating')!) : 0;

  try {
    // Build query
    let query = db.attendees;

    // Apply filters
    if (search) {
      query = query.where('name', 'ilike', `%${search}%`)
                  .orWhere('title', 'ilike', `%${search}%`)
                  .orWhere('bio', 'ilike', `%${search}%`);
    }

    if (experience.length > 0) {
      query = query.whereIn('experience', experience);
    }

    if (verified) {
      query = query.where('verified', true);
    }

    if (minRating > 0) {
      query = query.where('rating', '>=', minRating);
    }

    // Get total count
    const total = await query.count('id');

    // Apply pagination
    const attendees = await query
      .orderBy('rating', 'desc')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .select('*');

    // Enrich with skills and interests
    const enrichedAttendees = await Promise.all(
      attendees.map(async (attendee) => ({
        ...attendee,
        skills: await db.attendeeSkills
          .where('attendee_id', attendee.id)
          .join('skills', 'skills.id', 'attendee_skills.skill_id')
          .select('skills.name'),
        interests: await db.attendeeInterests
          .where('attendee_id', attendee.id)
          .join('interests', 'interests.id', 'attendee_interests.interest_id')
          .select('interests.name'),
        badges: await db.attendeeBadges
          .where('attendee_id', attendee.id)
          .join('badges', 'badges.id', 'attendee_badges.badge_id')
          .select('badges.name'),
      }))
    );

    return NextResponse.json({
      attendees: enrichedAttendees,
      pagination: {
        currentPage: page,
        pageSize,
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / pageSize),
      },
    });
  } catch (error) {
    console.error('Failed to fetch attendees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendees' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create Page Component

Create a page to display the interface:

```typescript
// app/attendees/page.tsx

'use client';

import { AttendeeDiscovery } from '@/components/attendees';
import { useState, useEffect } from 'react';
import type { Attendee } from '@/types/attendee';

export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendees = async () => {
      try {
        const response = await fetch('/api/attendees?pageSize=24');
        const data = await response.json();
        setAttendees(data.attendees);
      } catch (error) {
        console.error('Failed to fetch attendees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendees();
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <AttendeeDiscovery
        attendees={attendees}
        loading={loading}
        defaultPageSize={12}
        showPageSizeSelector={true}
        onConnect={(id) => console.log('Connect:', id)}
        onViewProfile={(id) => console.log('View:', id)}
      />
    </main>
  );
}
```

### Step 4: Test the Integration

1. Verify the API endpoint returns data
2. Check that attendee cards render properly
3. Test search functionality
4. Test filters
5. Test pagination
6. Test responsive design on mobile

---

## Advanced Integration

### Using React Query (Recommended)

See `EXAMPLE_REACT_QUERY.tsx` for full implementation with:
- Automatic caching
- Request deduplication
- Optimistic updates
- Automatic refetching

### Server-Side Rendering (SSR)

```typescript
// app/attendees/page.tsx

import { AttendeeDiscovery } from '@/components/attendees';
import type { Attendee } from '@/types/attendee';

async function getAttendees(): Promise<Attendee[]> {
  const response = await fetch(
    `${process.env.API_URL}/api/attendees?pageSize=24`,
    { next: { revalidate: 300 } } // ISR: revalidate every 5 minutes
  );
  
  if (!response.ok) throw new Error('Failed to fetch attendees');
  
  const data = await response.json();
  return data.attendees;
}

export default async function AttendeesPage() {
  const attendees = await getAttendees();

  return (
    <main className="container mx-auto px-4 py-8">
      <AttendeeDiscovery attendees={attendees} />
    </main>
  );
}
```

### Real-time Updates with WebSockets

```typescript
'use client';

import { useEffect, useState } from 'react';
import { AttendeeDiscovery } from '@/components/attendees';
import type { Attendee } from '@/types/attendee';

export default function RealtimeAttendeesPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'attendee_updated') {
        setAttendees(prev => {
          const index = prev.findIndex(a => a.id === data.attendee.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data.attendee;
            return updated;
          }
          return prev;
        });
      }
    };

    return () => ws.close();
  }, []);

  return <AttendeeDiscovery attendees={attendees} />;
}
```

---

## Performance Optimization

### 1. Pagination
- Use server-side pagination to reduce data transfer
- Load only needed page of data

### 2. Search Debouncing
- Default debounce is 300ms
- Customize in component props

### 3. Database Indexing
- Create FULLTEXT index on name, title, bio
- Index on verified, rating, attendance columns

### 4. Image Optimization
- Use Next.js Image component for avatars
- Implement lazy loading for avatar images

### 5. Memoization
- Components use React.memo where appropriate
- Filters and searches are memoized

### 6. CDN for Avatars
- Store avatars in CDN for faster delivery
- Use responsive image formats (WebP)

---

## Troubleshooting

### Search not working
- Check that `onSearch` callback is implemented
- Verify API endpoint accepts search parameter
- Check debounce timing (default 300ms)

### Filters not applying
- Ensure `onFiltersChange` callback is implemented
- Verify selected filters are being sent to API
- Check filter parameter names match API expectations

### Cards not displaying
- Ensure attendee data matches `Attendee` type
- Check that required fields are present
- Verify CSS is loaded correctly

### Pagination issues
- Check total count is correct
- Verify pageSize parameter matches display
- Ensure page parameter is 1-indexed

### Performance problems
- Enable React Query for caching
- Implement pagination (don't load all attendees)
- Use database indices
- Consider image optimization

---

## Additional Resources

- [Attendee Discovery README](./ATTENDEE_DISCOVERY_README.md)
- [Component Examples](./EXAMPLE_BASIC.tsx)
- [React Query Example](./EXAMPLE_REACT_QUERY.tsx)
- [Storybook Stories](./AttendeeDiscovery.stories.tsx)
