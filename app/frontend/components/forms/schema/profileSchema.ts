import { z } from 'zod';
import { httpsUrl } from './eventSchema';

export const profileInfoSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name cannot exceed 50 characters'),

  bio: z
    .string()
    .max(160, 'Bio cannot exceed 160 characters')
    .optional()
    .or(z.literal('')),

  location: z
    .string()
    .max(60, 'Location cannot exceed 60 characters')
    .optional()
    .or(z.literal('')),

  website: httpsUrl.optional().or(z.literal('')),
});

export type ProfileInfoValues = z.infer<typeof profileInfoSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const notificationsSchema = z.object({
  emailEvents: z.boolean(),
  emailUpdates: z.boolean(),
  pushReminders: z.boolean(),
});

export type NotificationsValues = z.infer<typeof notificationsSchema>;

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  displayName: 'Display Name',
  bio: 'Bio',
  location: 'Location',
  website: 'Website',
  currentPassword: 'Current Password',
  newPassword: 'New Password',
  confirmPassword: 'Confirm Password',
};
