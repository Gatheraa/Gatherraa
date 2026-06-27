export class VerificationStepResponse {
  id: string;
  step: string;
  status: string;
  metadata?: Record<string, any>;
  rejectionReason?: string;
  attemptCount: number;
  maxAttempts: number;
  isRequired: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class VerificationHistoryResponse {
  id: string;
  action: string;
  message?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class VerificationSummaryResponse {
  steps: VerificationStepResponse[];
  history: VerificationHistoryResponse[];
  overallProgress: number;
  isVerified: boolean;
}
