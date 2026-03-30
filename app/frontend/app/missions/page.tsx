'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from 'lucide-react';

import MissionCard from '@/app/Components/missions/MissionCard';
import EmptyState from '@/app/Components/missions/EmptyState';
import ErrorState from '@/app/Components/missions/ErrorState';
import SkeletonCard from '@/app/Components/missions/SkeletonCard';
import WalletNotConnected from '@/app/Components/missions/WalletNotConnected';
import SearchInput from '../Components/missions/SearchInput';
import SortSelect from '../Components/missions/SortSelect';
import FilterPanel from '../Components/missions/FilterPanel';
import Pagination from '../Components/missions/Pagination';
// ─── Types ────────────────────────────────────────────────────────────────────

type MissionStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';
type MissionCategory = 'development' | 'design' | 'research' | 'marketing' | 'other';
type SortOption = 'newest' | 'reward-high' | 'reward-low';

interface Mission {
  id: number;
  title: string;
  description: string;
  reward: number;
  status: MissionStatus;
  category: MissionCategory;
  deadline: string;
  createdAt: string;
  tags: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_MISSIONS: Mission[] = [
  { id: 1, title: 'Build REST API for User Auth', description: 'Design and implement a secure authentication API using JWT tokens and refresh token rotation.', reward: 850, status: 'open', category: 'development', deadline: '2024-08-01', createdAt: '2024-06-20', tags: ['Rust', 'API', 'Security'] },
  { id: 2, title: 'Redesign Onboarding Flow', description: 'Improve the onboarding experience for new contributors with clear steps and progress tracking.', reward: 600, status: 'open', category: 'design', deadline: '2024-07-25', createdAt: '2024-06-18', tags: ['Figma', 'UX', 'Research'] },
  { id: 3, title: 'Smart Contract Audit', description: 'Perform a comprehensive security audit of the payment smart contracts on Stellar.', reward: 1200, status: 'in-progress', category: 'development', deadline: '2024-07-30', createdAt: '2024-06-15', tags: ['Soroban', 'Security', 'Stellar'] },
  { id: 4, title: 'Write Technical Documentation', description: 'Document all public APIs and write a getting started guide for new developers.', reward: 300, status: 'open', category: 'research', deadline: '2024-07-20', createdAt: '2024-06-14', tags: ['Docs', 'Writing', 'API'] },
  { id: 5, title: 'Community Growth Strategy', description: 'Develop a strategy to grow the contributor community by 50% in Q3.', reward: 450, status: 'open', category: 'marketing', deadline: '2024-08-10', createdAt: '2024-06-12', tags: ['Growth', 'Community', 'Strategy'] },
  { id: 6, title: 'Performance Optimization', description: 'Profile and optimize the frontend bundle size and load time by at least 40%.', reward: 700, status: 'completed', category: 'development', deadline: '2024-06-10', createdAt: '2024-05-20', tags: ['Next.js', 'Performance', 'Webpack'] },
  { id: 7, title: 'Mobile Responsive Fixes', description: 'Fix layout issues across mobile breakpoints and improve touch interactions.', reward: 400, status: 'open', category: 'design', deadline: '2024-07-18', createdAt: '2024-06-10', tags: ['CSS', 'Mobile', 'Tailwind'] },
  { id: 8, title: 'Competitor Analysis Report', description: 'Analyze top 5 competitors and identify feature gaps and opportunities.', reward: 250, status: 'open', category: 'research', deadline: '2024-07-22', createdAt: '2024-06-08', tags: ['Research', 'Analysis'] },
  { id: 9, title: 'Integrate Payment Gateway', description: 'Integrate Stripe payment gateway with webhook support and error handling.', reward: 950, status: 'in-progress', category: 'development', deadline: '2024-07-28', createdAt: '2024-06-05', tags: ['Stripe', 'Payments', 'TypeScript'] },
  { id: 10, title: 'Email Marketing Campaign', description: 'Design and execute an email campaign to re-engage inactive contributors.', reward: 350, status: 'cancelled', category: 'marketing', deadline: '2024-06-30', createdAt: '2024-06-01', tags: ['Email', 'Marketing'] },
  { id: 11, title: 'Database Schema Migration', description: 'Migrate existing PostgreSQL schema to support multi-tenancy with zero downtime.', reward: 1100, status: 'open', category: 'development', deadline: '2024-08-05', createdAt: '2024-05-30', tags: ['PostgreSQL', 'Migration', 'Backend'] },
  { id: 12, title: 'Accessibility Compliance Audit', description: 'Audit the platform against WCAG 2.1 AA standards and fix all critical issues.', reward: 500, status: 'open', category: 'design', deadline: '2024-07-31', createdAt: '2024-05-28', tags: ['A11y', 'WCAG', 'HTML'] },
];

const ITEMS_PER_PAGE = 6;

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<MissionStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
};

const categoryConfig: Record<MissionCategory, { label: string; icon: string }> = {
  development: { label: 'Development', icon: '⚙️' },
  design: { label: 'Design', icon: '🎨' },
  research: { label: 'Research', icon: '🔍' },
  marketing: { label: 'Marketing', icon: '📣' },
  other: { label: 'Other', icon: '📌' },
};


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [walletConnected] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<MissionCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const fetchMissions = () => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      setMissions(MOCK_MISSIONS);
      setIsLoading(false);
    }, 1200);
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, sortBy]);

  const filtered = useMemo(() => {
    let result = [...missions];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') result = result.filter((m) => m.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter((m) => m.category === categoryFilter);

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'reward-high') return b.reward - a.reward;
      if (sortBy === 'reward-low') return a.reward - b.reward;
      return 0;
    });

    return result;
  }, [missions, search, statusFilter, categoryFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const hasFilters = search !== '' || statusFilter !== 'all' || categoryFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('newest');
  };

  const activeFilterCount = [search !== '', statusFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mission Marketplace</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Discover and apply for missions to earn rewards</p>
        </div>

        {/* Wallet banner */}
        {!walletConnected && <WalletNotConnected />}

        {/* Search + Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
/>
          <div className="flex gap-2">
            <SortSelect value={sortBy} onChange={setSortBy} />

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border rounded-lg transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-xs bg-white text-blue-600 rounded-full font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>


         {showFilters && (
  <FilterPanel 
    statusFilter={statusFilter}
    setStatusFilter={setStatusFilter}
    categoryFilter={categoryFilter}
    setCategoryFilter={setCategoryFilter}
    hasFilters={hasFilters}
    resetFilters={resetFilters}
    statusConfig={statusConfig}
    categoryConfig={categoryConfig}
  />
)}
       
        {/* Results count */}
        {!isLoading && !isError && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {filtered.length === 0
              ? 'No missions found'
              : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} mission${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}

        {/* Mission Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : isError ? (
            <ErrorState onRetry={fetchMissions} />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
          ) : (
            paginated.map((mission) => <MissionCard key={mission.id} mission={mission} />)
          )}
        </div>

        <Pagination 
      currentPage={currentPage}
      totalPages={totalPages}
      setCurrentPage={setCurrentPage}
      isLoading={isLoading}
      isError={isError}
/>
        
      </div>
    </div>
  );
}
