'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import FormInput from '@/components/forms/FormInput';
import ErrorSummary from '@/components/forms/ErrorSummary';
import {
  changePasswordSchema,
  type ChangePasswordValues,
  PROFILE_FIELD_LABELS,
} from '@/components/forms/schema/profileSchema';
import { profileApi } from '@/lib/api/profile';

function ToggleVisibility({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-[#4a5568] hover:text-white transition-colors focus-visible:outline-none"
      aria-label={visible ? 'Hide password' : 'Show password'}
      tabIndex={-1}
    >
      {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

export function SecurityForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
  });

  const onSubmit = async (values: ChangePasswordValues) => {
    setApiError(null);
    try {
      await profileApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSaved(true);
      reset();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={errors} fieldLabels={PROFILE_FIELD_LABELS} />

      {apiError && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {apiError}
        </p>
      )}

      <FormInput
        label="Current Password"
        type={showCurrent ? 'text' : 'password'}
        error={errors.currentPassword}
        required
        rightElement={
          <ToggleVisibility
            visible={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
          />
        }
        {...register('currentPassword')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="New Password"
          type={showNew ? 'text' : 'password'}
          error={errors.newPassword}
          required
          hint="Minimum 8 characters"
          rightElement={
            <ToggleVisibility
              visible={showNew}
              onToggle={() => setShowNew((v) => !v)}
            />
          }
          {...register('newPassword')}
        />

        <FormInput
          label="Confirm Password"
          type={showConfirm ? 'text' : 'password'}
          error={errors.confirmPassword}
          required
          rightElement={
            <ToggleVisibility
              visible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />
          }
          {...register('confirmPassword')}
        />
      </div>

      <div className="flex items-center gap-3 justify-end pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="w-4 h-4" />
            Password updated
          </span>
        )}
        <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}
