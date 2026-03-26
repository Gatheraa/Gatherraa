'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  notificationsSchema,
  type NotificationsValues,
} from '@/components/forms/schema/profileSchema';
import { profileApi, type NotificationPrefs } from '@/lib/api/profile';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}

function ToggleSwitch({ id, checked, onChange, label, description }: ToggleSwitchProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4 py-3 cursor-pointer group"
    >
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[var(--color-primary)] transition-colors">
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
      </div>

      <div className="relative flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 ${
            checked ? 'bg-[var(--color-primary)]' : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </div>
      </div>
    </label>
  );
}

interface NotificationsFormProps {
  defaultValues?: Partial<NotificationsValues>;
}

export function NotificationsForm({ defaultValues }: NotificationsFormProps) {
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { isSubmitting } } = useForm<NotificationsValues>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      emailEvents: true,
      emailUpdates: false,
      pushReminders: true,
      ...defaultValues,
    },
  });

  const onSubmit = async (values: NotificationsValues) => {
    setApiError(null);
    try {
      const prefs: NotificationPrefs = {
        emailEvents: values.emailEvents,
        emailUpdates: values.emailUpdates,
        pushReminders: values.pushReminders,
      };
      await profileApi.updateNotifications(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to save preferences');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-1">
      {apiError && (
        <p role="alert" className="text-sm text-[var(--color-error)] mb-3">
          {apiError}
        </p>
      )}

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        <Controller
          name="emailEvents"
          control={control}
          render={({ field }) => (
            <ToggleSwitch
              id="emailEvents"
              checked={field.value}
              onChange={field.onChange}
              label="Event notifications"
              description="Get emailed when events you follow are updated or cancelled"
            />
          )}
        />
        <Controller
          name="emailUpdates"
          control={control}
          render={({ field }) => (
            <ToggleSwitch
              id="emailUpdates"
              checked={field.value}
              onChange={field.onChange}
              label="Product updates"
              description="Receive news about new features and platform improvements"
            />
          )}
        />
        <Controller
          name="pushReminders"
          control={control}
          render={({ field }) => (
            <ToggleSwitch
              id="pushReminders"
              checked={field.value}
              onChange={field.onChange}
              label="Push reminders"
              description="Browser push notifications for upcoming events you're attending"
            />
          )}
        />
      </div>

      <div className="flex items-center gap-3 justify-end pt-4">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="w-4 h-4" />
            Preferences saved
          </span>
        )}
        <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </form>
  );
}
