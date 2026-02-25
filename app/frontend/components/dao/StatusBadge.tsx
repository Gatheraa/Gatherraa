import React from 'react';
import { Badge, type BadgeVariant } from '@/components/ui';

interface StatusBadgeProps {
  status: 'Active' | 'Passed' | 'Failed';
}

const statusVariant: Record<StatusBadgeProps['status'], BadgeVariant> = {
  Active: 'info',
  Passed: 'success',
  Failed: 'error',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <Badge variant={statusVariant[status]} aria-label={`Proposal status: ${status}`}>
    {status}
  </Badge>
);

export default StatusBadge;