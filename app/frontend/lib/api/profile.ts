import { apiGet, apiPatch, apiPost } from './client';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  bio?: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  role: 'user' | 'organizer' | 'admin';
  createdAt: string;
  notifications: NotificationPrefs;
}

export interface UpdateProfileDto {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface NotificationPrefs {
  emailEvents: boolean;
  emailUpdates: boolean;
  pushReminders: boolean;
}

export const profileApi = {
  getProfile: (): Promise<UserProfile> => apiGet('/users/me'),

  updateProfile: (data: UpdateProfileDto): Promise<UserProfile> =>
    apiPatch('/users/me', data),

  changePassword: (data: ChangePasswordDto): Promise<void> =>
    apiPost('/users/me/password', data),

  updateNotifications: (data: NotificationPrefs): Promise<NotificationPrefs> =>
    apiPatch('/users/me/notifications', data),
};
