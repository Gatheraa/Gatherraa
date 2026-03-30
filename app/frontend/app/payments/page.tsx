"use client";

import { useState } from 'react';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { useGetMyPayments } from '../../lib/react-query/hooks/payments/useGetMyPayments';
import { PaystackPaymentButton } from '../../components/payments/PaystackPaymentButton';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Calendar,
  Building,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

type PaymentStatus = 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED';

const statusConfig = {
  SUCCESS: {
    label: 'Success',
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: CheckCircle,
  },
  PENDING: {
    label: 'Pending',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    icon: Clock,
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-600 bg-red-50 border-red-200',
    icon: XCircle,
  },
};

const statusTabs: PaymentStatus[] = ['ALL', 'SUCCESS', 'PENDING', 'FAILED'];

export default function PaymentsPage() {
  const [activeStatus, setActiveStatus] = useState<PaymentStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const statusFilter = activeStatus === 'ALL' ? undefined : activeStatus;
  
  const { data: paymentsData, isLoading, error } = useGetMyPayments({
    page: currentPage,
    limit: 10,
    status: statusFilter,
  });

  const payments = paymentsData?.data || [];
  const meta = paymentsData?.meta;

  const handleStatusChange = (status: PaymentStatus) => {
    setActiveStatus(status);
    setCurrentPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount / 100); // Convert from kobo to naira
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <DashboardLayout
      navbarTitle="Payment History"
      sidebarProps={{
        activeItemId: 'payments',
      }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Payment History
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            View and manage all your payment transactions
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          {statusTabs.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeStatus === status
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
              }`}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-32"></div>
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
                    </div>
                    <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-20"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-28"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">
              Failed to load payments. Please try again later.
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && payments.length === 0 && (
          <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <CreditCard className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">
              No payments found
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {activeStatus === 'ALL' 
                ? "You haven't made any payments yet."
                : `No ${activeStatus.toLowerCase()} payments found.`
              }
            </p>
          </div>
        )}

        {/* Payments List */}
        {!isLoading && !error && payments.length > 0 && (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-zinc-500" />
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {payment.booking.workspace.name}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Ref: {payment.reference}
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    {getStatusBadge(payment.status)}
                    <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(payment.createdAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowLeftRight className="w-4 h-4" />
                      {formatDate(payment.booking.startDate)} - {formatDate(payment.booking.endDate)}
                    </div>
                  </div>
                  
                  {/* Pay Now button for confirmed bookings without successful payment */}
                  {payment.status === 'PENDING' && (
                    <PaystackPaymentButton
                      bookingId={payment.bookingId}
                      amountKobo={payment.amount}
                      onSuccess={() => {
                        // Refresh the payments list
                        window.location.reload();
                      }}
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && meta && meta.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {currentPage} of {meta.totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(meta.totalPages, prev + 1))}
              disabled={currentPage === meta.totalPages}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
