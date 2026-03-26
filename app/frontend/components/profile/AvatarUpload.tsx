'use client';

import { useRef } from 'react';
import { Camera } from 'lucide-react';

export interface AvatarUploadProps {
  name: string;
  avatarUrl?: string;
  onFileSelect: (file: File) => void;
  size?: 'md' | 'lg';
}

export function AvatarUpload({
  name,
  avatarUrl,
  onFileSelect,
  size = 'lg',
}: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const dimension = size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const textSize = size === 'lg' ? 'text-2xl' : 'text-base';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`relative group ${dimension} rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]`}
        aria-label="Change profile picture"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-[var(--color-primary)] flex items-center justify-center ${textSize} font-semibold text-white`}>
            {initials}
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Camera className="w-5 h-5 text-white" />
        </div>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
        aria-hidden
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors focus-visible:outline-none focus-visible:underline"
      >
        Change photo
      </button>
    </div>
  );
}
