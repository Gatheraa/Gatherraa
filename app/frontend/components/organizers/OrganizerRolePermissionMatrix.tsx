'use client';

import React, { useState, useCallback } from 'react';
import { Shield, Users, Eye, ChevronDown, ChevronUp, Check, X, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrganizerRole = 'admin' | 'co-organizer' | 'moderator';

export interface Permission {
  id: string;
  label: string;
  description: string;
}

export interface RoleDefinition {
  role: OrganizerRole;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  permissions: string[]; // permission IDs
}

// ─── Data ─────────────────────────────────────────────────────────────────────

export const ALL_PERMISSIONS: Permission[] = [
  { id: 'manage-event', label: 'Manage Event', description: 'Create, edit, and delete event details' },
  { id: 'manage-tickets', label: 'Manage Tickets', description: 'Create and modify ticket types and pricing' },
  { id: 'manage-attendees', label: 'Manage Attendees', description: 'View and manage attendee list, check-ins' },
  { id: 'manage-staff', label: 'Manage Staff', description: 'Invite and remove co-organizers and moderators' },
  { id: 'manage-payments', label: 'Manage Payments', description: 'Access payment settings and payout information' },
  { id: 'view-analytics', label: 'View Analytics', description: 'Access event analytics and reports' },
  { id: 'moderate-content', label: 'Moderate Content', description: 'Review and moderate user-generated content' },
  { id: 'send-announcements', label: 'Send Announcements', description: 'Send announcements to attendees' },
  { id: 'manage-sponsors', label: 'Manage Sponsors', description: 'Add and manage sponsor listings' },
  { id: 'manage-settings', label: 'Manage Settings', description: 'Access event settings and integrations' },
];

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'admin',
    label: 'Admin',
    description: 'Full access to all event management features',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    permissions: ['manage-event', 'manage-tickets', 'manage-attendees', 'manage-staff', 'manage-payments', 'view-analytics', 'moderate-content', 'send-announcements', 'manage-sponsors', 'manage-settings'],
  },
  {
    role: 'co-organizer',
    label: 'Co-organizer',
    description: 'Can manage most event aspects except staff and payments',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    permissions: ['manage-event', 'manage-tickets', 'manage-attendees', 'view-analytics', 'moderate-content', 'send-announcements', 'manage-sponsors', 'manage-settings'],
  },
  {
    role: 'moderator',
    label: 'Moderator',
    description: 'Can view content and moderate discussions',
    icon: Eye,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    permissions: ['manage-attendees', 'view-analytics', 'moderate-content'],
  },
];

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg whitespace-nowrap z-10">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
        </span>
      )}
    </span>
  );
}

// ─── PermissionRow ───────────────────────────────────────────────────────────

interface PermissionRowProps {
  permission: Permission;
  roles: RoleDefinition[];
  roleStates: Record<OrganizerRole, boolean>;
  onToggle: (role: OrganizerRole, permissionId: string) => void;
  editable: boolean;
}

function PermissionRow({ permission, roles, roleStates, onToggle, editable }: PermissionRowProps) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center">
          {permission.label}
          <Tooltip text={permission.description} />
        </div>
      </td>
      {roles.map((roleDef) => {
        const hasPermission = roleDef.permissions.includes(permission.id);
        const isChecked = roleStates[roleDef.role] !== undefined
          ? roleStates[roleDef.role] && hasPermission
          : hasPermission;
        return (
          <td key={roleDef.role} className="py-3 px-4 text-center">
            {editable ? (
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                aria-label={`${permission.label} for ${roleDef.label}`}
                onClick={() => onToggle(roleDef.role, permission.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isChecked
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              >
                {isChecked && <Check className="w-3 h-3" />}
              </button>
            ) : isChecked ? (
              <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
            ) : (
              <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ─── RoleHierarchy ───────────────────────────────────────────────────────────

function RoleHierarchy({ roles }: { roles: RoleDefinition[] }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {roles.map((roleDef, idx) => {
        const Icon = roleDef.icon;
        return (
          <React.Fragment key={roleDef.role}>
            <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 ${roleDef.bgColor}`}>
              <Icon className={`w-6 h-6 ${roleDef.color}`} />
              <span className={`text-sm font-semibold ${roleDef.color}`}>{roleDef.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[120px]">
                {roleDef.permissions.length} permissions
              </span>
            </div>
            {idx < roles.length - 1 && (
              <div className="flex flex-col items-center text-gray-400">
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                <span className="text-[10px] mt-1">less access</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface OrganizerRolePermissionMatrixProps {
  /** Initial permission overrides (role → permission ID → boolean) */
  initialOverrides?: Record<OrganizerRole, Record<string, boolean>>;
  /** Callback when permissions change */
  onChange?: (role: OrganizerRole, permissionId: string, value: boolean) => void;
  /** Whether the matrix is editable */
  editable?: boolean;
  /** Additional className */
  className?: string;
}

export function OrganizerRolePermissionMatrix({
  initialOverrides,
  onChange,
  editable = false,
  className = '',
}: OrganizerRolePermissionMatrixProps) {
  const [roleStates, setRoleStates] = useState<Record<OrganizerRole, boolean>>(() => {
    const states: Record<string, boolean> = {};
    ROLE_DEFINITIONS.forEach((r) => {
      states[r.role] = true;
    });
    return states as Record<OrganizerRole, boolean>;
  });
  const [expanded, setExpanded] = useState(true);

  const handleToggle = useCallback(
    (role: OrganizerRole, permissionId: string) => {
      setRoleStates((prev) => {
        const newState = { ...prev, [role]: !prev[role] };
        return newState;
      });
      onChange?.(role, permissionId, !roleStates[role]);
    },
    [onChange, roleStates]
  );

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Organizer Roles & Permissions
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage what each role can do for your event
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {expanded && (
        <>
          {/* Role Hierarchy Visualization */}
          <div className="px-6 pt-4 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Role Hierarchy
            </h3>
            <RoleHierarchy roles={ROLE_DEFINITIONS} />
          </div>

          {/* Permission Matrix */}
          <div className="px-6 pb-6 pt-2 overflow-x-auto">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Permission Matrix
            </h3>
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Permission
                  </th>
                  {ROLE_DEFINITIONS.map((roleDef) => (
                    <th key={roleDef.role} className="text-center py-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <span className={roleDef.color}>{roleDef.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map((perm) => (
                  <PermissionRow
                    key={perm.id}
                    permission={perm}
                    roles={ROLE_DEFINITIONS}
                    roleStates={roleStates}
                    onToggle={handleToggle}
                    editable={editable}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default OrganizerRolePermissionMatrix;
