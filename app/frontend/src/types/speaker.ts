export type SpeakerStatus = 'confirmed' | 'pending' | 'cancelled';

export interface Speaker {
  id: string;
  name: string;
  email: string;
  bio: string;
  company: string;
  title: string;
  topic: string;
  status: SpeakerStatus;
  avatarUrl?: string;
  sessionTime?: string;
  createdAt: string;
}

export type SpeakerFormData = Omit<Speaker, 'id' | 'createdAt'>;