'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui';
import FormInput from '@/components/forms/FormInput';
import ErrorSummary from '@/components/forms/ErrorSummary';
import {
  profileInfoSchema,
  type ProfileInfoValues,
  PROFILE_FIELD_LABELS,
} from '@/components/forms/schema/profileSchema';
import { profileApi, type UpdateProfileDto } from '@/lib/api/profile';

interface ProfileFormProps {
  defaultValues?: Partial<ProfileInfoValues>;
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ProfileInfoValues>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues: {
      displayName: '',
      bio: '',
      location: '',
      website: '',
      ...defaultValues,
    },
    mode: 'onChange',
  });

  const onSubmit = async (values: ProfileInfoValues) => {
    setApiError(null);
    try {
      const payload: UpdateProfileDto = {
        displayName: values.displayName,
        bio: values.bio || undefined,
        location: values.location || undefined,
        website: values.website || undefined,
      };
      await profileApi.updateProfile(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to save changes');
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="Display Name"
          error={errors.displayName}
          isValid={!errors.displayName && !!dirtyFields.displayName}
          required
          placeholder="Your name"
          {...register('displayName')}
        />
        <FormInput
          label="Location"
          error={errors.location}
          isValid={!errors.location && !!dirtyFields.location}
          placeholder="City, Country"
          {...register('location')}
        />
      </div>

      <FormInput
        label="Bio"
        as="textarea"
        rows={3}
        error={errors.bio}
        isValid={!errors.bio && !!dirtyFields.bio}
        placeholder="Tell people a little about yourself"
        {...register('bio')}
      />

      <FormInput
        label="Website"
        error={errors.website}
        isValid={!errors.website && !!dirtyFields.website}
        placeholder="https://yoursite.com"
        type="url"
        hint="Must start with https://"
        {...register('website')}
      />

      <div className="flex items-center gap-3 justify-end pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
