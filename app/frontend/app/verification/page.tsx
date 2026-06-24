'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  History,
  Layers,
  UserCheck,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { SkeletonPage } from '@/components/ui';
import { VerificationSteps } from '@/components/identity-verification/VerificationSteps';
import { VerificationHistory } from '@/components/identity-verification/VerificationHistory';
import { identityVerificationApi } from '@/lib/api/identity-verification';
import type { VerificationSummary } from '@/types/identity-verification';
import { CollapsibleSection } from '@/components/profile/CollapsibleSection';

export default function VerificationPage() {
  const [data, setData] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await identityVerificationApi.getSummary();
      setData(summary);
    } catch (err: any) {
      if (err.statusCode === 404 || err.message?.includes('not found')) {
        try {
          setInitializing(true);
          await identityVerificationApi.initializeSteps();
          const summary = await identityVerificationApi.getSummary();
          setData(summary);
        } catch {
          setError('Failed to initialize verification steps.');
        } finally {
          setInitializing(false);
        }
      } else {
        setError(err.message || 'Failed to load verification data.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = useCallback(
    async (step: string) => {
      try {
        await identityVerificationApi.retryStep(step);
        const summary = await identityVerificationApi.getSummary();
        setData(summary);
      } catch (err: any) {
        setError(err.message || 'Failed to retry step.');
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (step: string, metadata?: Record<string, any>) => {
      try {
        await identityVerificationApi.submitStep(step, metadata);
        const summary = await identityVerificationApi.getSummary();
        setData(summary);
      } catch (err: any) {
        setError(err.message || 'Failed to submit step.');
      }
    },
    [],
  );

  if (loading || initializing) {
    return (
      <DashboardLayout navbarTitle="Identity Verification">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-zinc-500">
              {initializing
                ? 'Setting up verification...'
                : 'Loading verification data...'}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const completedSteps = data?.steps.filter(
    (s) => s.status === 'completed',
  ).length ?? 0;
  const totalSteps = data?.steps.length ?? 0;
  const progress = data?.overallProgress ?? 0;

  return (
    <DashboardLayout
      navbarTitle="Identity Verification"
      navbarUser={undefined}
    >
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
            <button
              onClick={fetchData}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}

        <div className="flex flex-col lg:grid lg:grid-cols-[280px_1fr] gap-6 lg:gap-8 items-start">
          <aside className="w-full lg:sticky lg:top-6 space-y-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col items-center gap-4 text-center">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  data?.isVerified
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                }`}
              >
                {data?.isVerified ? (
                  <UserCheck className="w-8 h-8" />
                ) : (
                  <Shield className="w-8 h-8" />
                )}
              </div>

              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {data?.isVerified ? 'Verified' : 'Verification Needed'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {data?.isVerified
                    ? 'All steps completed'
                    : `${completedSteps}/${totalSteps} steps done`}
                </p>
              </div>

              <div className="w-full">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      progress === 100
                        ? 'bg-emerald-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {data?.isVerified && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg w-full justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                  All verifications passed
                </div>
              )}
            </div>
          </aside>

          <div className="w-full flex flex-col gap-3">
            <CollapsibleSection
              title="Verification Steps"
              description="Complete each step to verify your identity"
              icon={<Layers className="w-4 h-4" />}
              defaultExpanded
            >
              <VerificationSteps
                steps={data?.steps ?? []}
                onRetry={handleRetry}
                onSubmit={handleSubmit}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Verification History"
              description="Timeline of all verification activities"
              icon={<History className="w-4 h-4" />}
            >
              <VerificationHistory history={data?.history ?? []} />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
