import { z } from 'zod';

// ─── Shared reusable validators ───────────────────────────────────────────────
export const stellarAddress = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar address (starts with G, 56 chars)')
  .or(z.literal(''));

export const httpsUrl = z
  .string()
  .url('Must be a valid URL including https://')
  .startsWith('https://', 'URL must start with https://')
  .or(z.literal(''));

// ─── Create / Edit Event ──────────────────────────────────────────────────────
export const createEventSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(80, 'Title cannot exceed 80 characters'),

  description: z
    .string()
    .min(1, 'Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters'),

  category: z.enum(['conference', 'workshop', 'concert', 'hackathon', 'meetup'], {
    errorMap: () => ({ message: 'Please select a category' }),
  }),

  ticketPrice: z
    .string()
    .min(1, 'Ticket price is required')
    .refine((v) => !isNaN(Number(v)), { message: 'Must be a valid number' })
    .refine((v) => Number(v) >= 0, { message: 'Price cannot be negative' }),

  maxAttendees: z
    .string()
    .min(1, 'Max attendees is required')
    .refine((v) => !isNaN(Number(v)), { message: 'Must be a valid number' })
    .refine((v) => Number.isInteger(Number(v)), { message: 'Must be a whole number' })
    .refine((v) => Number(v) >= 1, { message: 'Must allow at least 1 attendee' }),

  contractAddress: z.string().optional().or(z.literal('')),

  websiteUrl: z.string().optional().or(z.literal('')),

  isPublic: z.boolean().default(true),
});

export type CreateEventFormValues = z.infer<typeof createEventSchema>;

// ─── Human-readable labels used by ErrorSummary ───────────────────────────────
export const EVENT_FIELD_LABELS: Record<string, string> = {
  title: 'Event Title',
  description: 'Description',
  category: 'Category',
  ticketPrice: 'Ticket Price',
  maxAttendees: 'Max Attendees',
  contractAddress: 'Contract Address',
  websiteUrl: 'Website URL',
  isPublic: 'Visibility',
};

// ─── Default form values ──────────────────────────────────────────────────────
export const createEventDefaults: CreateEventFormValues = {
  title: '',
  description: '',
  category: 'conference',
  ticketPrice: '0',
  maxAttendees: '100',
  contractAddress: '',
  websiteUrl: '',
  isPublic: true,
};