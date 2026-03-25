'use client';

import { useEffect, useState } from 'react';
import {
  User,
  Lock,
  Bell,
  Trash2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { SkeletonPage } from '@/components/ui';
import { CollapsibleSection } from '@/components/profile/CollapsibleSection';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { SecurityForm } from '@/components/profile/SecurityForm';
import { NotificationsForm } from '@/components/profile/NotificationsForm';
import { DangerZoneSection } from '@/components/profile/DangerZoneSection';
import { profileApi, type UserProfile } from '@/lib/api/profile';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi
      .getProfile()
      .then(setProfile)
      .catch(() => {
        /* Silently fail — forms render with empty defaults */
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFileSelect = (file: File) => {
    /* Upload logic — wire to apiUpload once avatar endpoint exists */
    console.info('Avatar file selected:', file.name);
  };

  if (loading) {
    return (
      <DashboardLayout navbarTitle="Profile & Settings">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      navbarTitle="Profile & Settings"
      navbarUser={
        profile
          ? {
              name: profile.displayName,
              email: profile.email,
              avatar: profile.avatarUrl,
            }
          : undefined
      }
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr] gap-6 lg:gap-8 items-start">

          {/* Left: Identity card */}
          <aside className="w-full lg:sticky lg:top-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center gap-4 text-center">
              <AvatarUpload
                name={profile?.displayName ?? 'User'}
                avatarUrl={profile?.avatarUrl}
                onFileSelect={handleFileSelect}
              />

              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {profile?.displayName ?? '—'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {profile?.email ?? ''}
                </p>
              </div>

              {profile?.bio && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3 w-full">
                  {profile.bio}
                </p>
              )}

              <div className="w-full border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-primary-muted)] text-[var(--color-primary-muted-foreground)] capitalize">
                  {profile?.role ?? 'user'}
                </span>
              </div>
            </div>
          </aside>

          {/* Right: Settings sections */}
          <div className="w-full flex flex-col gap-3">
            <CollapsibleSection
              title="Personal Information"
              description="Update your display name, bio, and links"
              icon={<User className="w-4 h-4" />}
              defaultExpanded
            >
              <ProfileForm
                defaultValues={{
                  displayName: profile?.displayName ?? '',
                  bio: profile?.bio ?? '',
                  location: profile?.location ?? '',
                  website: profile?.website ?? '',
                }}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Security"
              description="Change your password"
              icon={<Lock className="w-4 h-4" />}
            >
              <SecurityForm />
            </CollapsibleSection>

            <CollapsibleSection
              title="Notifications"
              description="Control how and when you hear from us"
              icon={<Bell className="w-4 h-4" />}
            >
              <NotificationsForm
                defaultValues={profile?.notifications}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Danger Zone"
              description="Deactivate or permanently delete your account"
              icon={<Trash2 className="w-4 h-4" />}
            >
              <DangerZoneSection />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
