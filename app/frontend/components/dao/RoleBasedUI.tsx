import React from 'react';
import { RoleGate } from './RoleGate';

/**
 * Centralizes all role-conditional UI buttons for Gatheraa.
 * Import and place these anywhere — they self-manage visibility.
 */

export const CreateMissionButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <RoleGate allowedRoles={['creator', 'admin']}>
    <button
      onClick={onClick}
      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
    >
      + Create Mission
    </button>
  </RoleGate>
);

export const ApproveSubmissionButton: React.FC<{
  submissionId: string;
  onApprove?: (id: string) => void;
}> = ({ submissionId, onApprove }) => (
  <RoleGate allowedRoles={['admin', 'creator']}>
    <button
      onClick={() => onApprove?.(submissionId)}
      className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
    >
      ✓ Approve Submission
    </button>
  </RoleGate>
);

export const CreateDAOButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <RoleGate allowedRoles={['admin']}>
    <button
      onClick={onClick}
      className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
    >
      ⬡ Create DAO
    </button>
  </RoleGate>
);