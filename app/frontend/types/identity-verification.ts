export type VerificationStep =
  | 'email'
  | 'phone'
  | 'government_id'
  | 'face_match'
  | 'wallet'
  | 'address';

export type VerificationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired';

export type VerificationAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'retried'
  | 'expired'
  | 'cancelled';

export interface VerificationStepItem {
  id: string;
  step: VerificationStep;
  status: VerificationStatus;
  metadata?: Record<string, any>;
  rejectionReason?: string;
  attemptCount: number;
  maxAttempts: number;
  isRequired: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationHistoryItem {
  id: string;
  action: VerificationAction;
  message?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface VerificationSummary {
  steps: VerificationStepItem[];
  history: VerificationHistoryItem[];
  overallProgress: number;
  isVerified: boolean;
}

export const STEP_LABELS: Record<VerificationStep, string> = {
  email: 'Email Verification',
  phone: 'Phone Verification',
  government_id: 'Government ID',
  face_match: 'Face Match',
  wallet: 'Wallet Confirmation',
  address: 'Address Verification',
};

export const STEP_DESCRIPTIONS: Record<VerificationStep, string> = {
  email: 'Verify your email address',
  phone: 'Add and verify your phone number',
  government_id: 'Upload a government-issued ID',
  face_match: 'Take a selfie for face matching',
  wallet: 'Confirm your wallet ownership',
  address: 'Verify your physical address',
};

export const STEP_ICONS: Record<VerificationStep, string> = {
  email: 'Mail',
  phone: 'Phone',
  government_id: 'FileText',
  face_match: 'ScanFace',
  wallet: 'Wallet',
  address: 'MapPin',
};
