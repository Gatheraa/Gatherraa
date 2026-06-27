import { apiGet, apiPost, apiPatch } from './client';
import type {
  VerificationSummary,
  VerificationStepItem,
  VerificationHistoryItem,
} from '@/types/identity-verification';

export const identityVerificationApi = {
  getSummary: (): Promise<VerificationSummary> =>
    apiGet('/identity-verification/summary'),

  getSteps: (): Promise<VerificationStepItem[]> =>
    apiGet('/identity-verification/steps'),

  getHistory: (): Promise<VerificationHistoryItem[]> =>
    apiGet('/identity-verification/history'),

  submitStep: (
    step: string,
    metadata?: Record<string, any>,
  ): Promise<VerificationStepItem> =>
    apiPost(`/identity-verification/steps/${step}/submit`, { metadata }),

  retryStep: (step: string): Promise<VerificationStepItem> =>
    apiPost(`/identity-verification/steps/${step}/retry`),

  initializeSteps: (): Promise<{ message: string }> =>
    apiPost('/identity-verification/initialize'),
};
