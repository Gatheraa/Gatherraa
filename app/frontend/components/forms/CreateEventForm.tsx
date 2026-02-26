'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import FormInput from './FormInput';
import ErrorSummary from './ErrorSummary';

// ─── Schema ───────────────────────────────────────────────────────────────────
const createEventSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(80, 'Title cannot exceed 80 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  contractAddress: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar/Soroban contract address')
    .or(z.literal('')),
  ticketPrice: z
    .string()
    .refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Must be a valid non-negative number'),
  maxAttendees: z
    .string()
    .refine(v => !isNaN(Number(v)) && Number(v) >= 1 && Number.isInteger(Number(v)), 'Must be a whole number ≥ 1'),
  category: z.enum(['conference', 'workshop', 'concert', 'hackathon', 'meetup', ''], {
    errorMap: () => ({ message: 'Please select a category' }),
  }).refine(v => v !== '', { message: 'Please select a category' }),
  isPublic: z.boolean(),
  websiteUrl: z
    .string()
    .url('Must be a valid URL (include https://)')
    .optional()
    .or(z.literal('')),
});

type CreateEventFormValues = z.infer<typeof createEventSchema>;

const FIELD_LABELS: Record<string, string> = {
  title: 'Event Title',
  description: 'Description',
  contractAddress: 'Contract Address',
  ticketPrice: 'Ticket Price',
  maxAttendees: 'Max Attendees',
  category: 'Category',
  isPublic: 'Visibility',
  websiteUrl: 'Website URL',
};

// ─── Icons (inline, no extra imports) ────────────────────────────────────────
const TagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M2 2h5.5l5.5 5.5-5.5 5.5L2 7.5V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
  </svg>
);
const CodeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M4.5 4L1.5 7.5 4.5 11M10.5 4l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const TicketIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1" y="4" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M10 4v7M5 7.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M1 12.5c0-2.485 2.015-4.5 4.5-4.5S10 10.015 10 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M11 8a3 3 0 010 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M13 5a2 2 0 010 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7.5 1.5c-2 2-2 8 0 12M7.5 1.5c2 2 2 8 0 12M1.5 7.5h12" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateEventForm() {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields, isSubmitSuccessful, dirtyFields },
    reset,
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: '',
      description: '',
      contractAddress: '',
      ticketPrice: '0',
      maxAttendees: '100',
      category: '',
      isPublic: true,
      websiteUrl: '',
    },
    mode: 'onChange', // real-time validation
  });

  const isFieldValid = (name: keyof CreateEventFormValues) =>
    dirtyFields[name] && !errors[name];

  const onSubmit = async (data: CreateEventFormValues) => {
    // Simulate async submit
    await new Promise(r => setTimeout(r, 1200));
    console.log('✅ Form submitted:', data);
  };

  if (isSubmitSuccessful) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-16 h-16 rounded-full border border-emerald-500/40 flex items-center justify-center bg-emerald-500/10 animate-[checkIn_0.4s_ease]">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M7 14l5 5 9-9" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-white font-semibold text-lg" style={{ fontFamily: "'DM Sans',sans-serif" }}>Event Created!</p>
        <p className="text-[#4a5568] text-sm" style={{ fontFamily: "'DM Mono',monospace" }}>Your event has been registered on-chain.</p>
        <button
          onClick={() => reset()}
          className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold border border-[#1e2333] text-[#6b7db3] hover:border-[#3d5afe]/40 hover:text-[#3d5afe] transition-all"
        >
          Create Another
        </button>
        <style>{`@keyframes checkIn { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }`}</style>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        input, textarea, select, button, label, p { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* Error Summary — shown after first submit attempt */}
      <ErrorSummary errors={errors} fieldLabels={FIELD_LABELS} />

      {/* Title */}
      <FormInput
        label="Event Title"
        name="title"
        type="text"
        placeholder="e.g. Stellar Dev Hackathon 2025"
        required
        icon={<TagIcon />}
        error={errors.title}
        isValid={isFieldValid('title')}
        hint="3–80 characters. Make it memorable."
        {...register('title')}
      />

      {/* Description */}
      <FormInput
        label="Description"
        name="description"
        as="textarea"
        rows={3}
        placeholder="Tell attendees what this event is about..."
        required
        error={errors.description}
        isValid={isFieldValid('description')}
        hint="10–500 characters."
        {...register('description')}
      />

      {/* Category */}
      <FormInput
        label="Category"
        name="category"
        as="select"
        required
        error={errors.category}
        isValid={isFieldValid('category')}
        {...register('category')}
      >
        <option value="">Select a category…</option>
        <option value="conference">Conference</option>
        <option value="workshop">Workshop</option>
        <option value="concert">Concert</option>
        <option value="hackathon">Hackathon</option>
        <option value="meetup">Meetup</option>
      </FormInput>

      {/* Price + Attendees side by side */}
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Ticket Price (XLM)"
          name="ticketPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          required
          icon={<TicketIcon />}
          error={errors.ticketPrice}
          isValid={isFieldValid('ticketPrice')}
          {...register('ticketPrice')}
        />
        <FormInput
          label="Max Attendees"
          name="maxAttendees"
          type="number"
          min="1"
          step="1"
          placeholder="100"
          required
          icon={<UsersIcon />}
          error={errors.maxAttendees}
          isValid={isFieldValid('maxAttendees')}
          {...register('maxAttendees')}
        />
      </div>

      {/* Contract Address */}
      <FormInput
        label="Contract Address"
        name="contractAddress"
        type="text"
        placeholder="GABC…"
        icon={<CodeIcon />}
        error={errors.contractAddress}
        isValid={isFieldValid('contractAddress')}
        hint="Optional. Stellar/Soroban contract address (starts with G)."
        {...register('contractAddress')}
      />

      {/* Website URL */}
      <FormInput
        label="Website URL"
        name="websiteUrl"
        type="url"
        placeholder="https://gatheraa.xyz/event"
        icon={<GlobeIcon />}
        error={errors.websiteUrl}
        isValid={isFieldValid('websiteUrl')}
        hint="Optional. Must include https://"
        {...register('websiteUrl')}
      />

      {/* Visibility toggle */}
      <Controller
        name="isPublic"
        control={control}
        render={({ field }) => (
          <div className="flex items-center justify-between rounded-xl border border-[#1e2333] bg-[#0f1117] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white" style={{ fontFamily: "'DM Sans',sans-serif" }}>
                Public Event
              </p>
              <p className="text-xs text-[#4a5568] mt-0.5" style={{ fontFamily: "'DM Mono',monospace" }}>
                Visible to all Gatheraa users
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              className={`relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 ${
                field.value ? 'bg-[#3d5afe]' : 'bg-[#1e2333]'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                field.value ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        )}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="relative w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200
          bg-[#3d5afe] hover:bg-[#536dfe] active:scale-[0.98]
          disabled:opacity-60 disabled:cursor-not-allowed
          shadow-[0_4px_20px_rgba(61,90,254,0.35)]
          hover:shadow-[0_4px_28px_rgba(61,90,254,0.5)]"
        style={{ fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.02em' }}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
            </svg>
            Creating Event…
          </span>
        ) : (
          'Create Event'
        )}
      </button>
    </form>
  );
}