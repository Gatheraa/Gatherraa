import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { RoleGate, ROLES, PERMISSIONS } from './RoleGate';

const meta: Meta<typeof RoleGate> = {
  title: 'UI/Molecules/RoleGate',
  component: RoleGate,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A wrapper component for role-based UI rendering with flexible access control.'
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN],
    userRoles: [ROLES.USER],
    children: <div className="p-4 bg-green-100 rounded">Protected Content</div>,
  },
};

export const WithAccess: Story = {
  args: {
    allowedRoles: [ROLES.USER],
    userRoles: [ROLES.USER],
    children: <div className="p-4 bg-green-100 rounded">You have access!</div>,
  },
};

export const WithoutAccess: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN],
    userRoles: [ROLES.USER],
    children: <div className="p-4 bg-green-100 rounded">Admin Content</div>,
  },
};

export const MultipleRoles: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN, ROLES.MODERATOR],
    userRoles: [ROLES.USER],
    children: <div className="p-4 bg-green-100 rounded">Admin/Moderator Content</div>,
  },
};

export const WithPermissions: Story = {
  args: {
    allowedRoles: [ROLES.USER],
    requiredPermissions: [PERMISSIONS.MANAGE_CONTENT],
    userRoles: [ROLES.USER],
    userPermissions: [PERMISSIONS.READ],
    children: <div className="p-4 bg-green-100 rounded">Content with Permissions</div>,
  },
};

export const StrictMode: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN, ROLES.MODERATOR],
    userRoles: [ROLES.ADMIN],
    strictMode: true,
    children: <div className="p-4 bg-green-100 rounded">Strict Mode Content</div>,
  },
};

export const WithFallback: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN],
    userRoles: [ROLES.USER],
    fallback: <div className="p-4 bg-red-100 rounded">Custom Fallback Message</div>,
    children: <div className="p-4 bg-green-100 rounded">Admin Content</div>,
  },
};

export const WithCustomRoleChecker: Story = {
  args: {
    allowedRoles: [ROLES.PREMIUM_USER],
    userRoles: [ROLES.USER],
    roleChecker: (userRoles, allowedRoles) => {
      // Custom logic: allow if user has 'user' role and it's a weekend
      const isWeekend = new Date().getDay() % 6 === 0;
      return userRoles.includes(ROLES.USER) && isWeekend;
    },
    children: <div className="p-4 bg-green-100 rounded">Weekend Premium Access</div>,
  },
};

export const RenderPropPattern: Story = {
  args: {
    allowedRoles: [ROLES.USER],
    userRoles: [ROLES.USER],
    children: (hasAccess) => (
      <div className="p-4">
        <div className="mb-2">
          <strong>Access Status:</strong> {hasAccess ? 'Granted' : 'Denied'}
        </div>
        <div className={`p-4 rounded ${hasAccess ? 'bg-green-100' : 'bg-red-100'}`}>
          {hasAccess ? 'You can see this content!' : 'Access denied'}
        </div>
      </div>
    ),
  },
};

export const WithLoading: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN],
    userRoles: [ROLES.USER],
    loadingComponent: <div className="p-4">Checking permissions...</div>,
    children: <div className="p-4 bg-green-100 rounded">Admin Content</div>,
  },
};

export const ComplexRoles: Story = {
  render: (args) => {
    const [userRoles, setUserRoles] = useState([ROLES.USER]);
    const [userPermissions, setUserPermissions] = useState([PERMISSIONS.READ]);
    
    return (
      <div className="space-y-4 p-4">
        <div className="space-x-2">
          <button
            onClick={() => setUserRoles([ROLES.ADMIN])}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            Set as Admin
          </button>
          <button
            onClick={() => setUserRoles([ROLES.USER])}
            className="px-3 py-1 bg-gray-500 text-white rounded"
          >
            Set as User
          </button>
          <button
            onClick={() => setUserPermissions([PERMISSIONS.MANAGE_CONTENT])}
            className="px-3 py-1 bg-green-500 text-white rounded"
          >
            Grant Permissions
          </button>
        </div>
        
        <RoleGate
          {...args}
          allowedRoles={[ROLES.ADMIN, ROLES.CONTENT_CREATOR]}
          requiredPermissions={[PERMISSIONS.MANAGE_CONTENT]}
          userRoles={userRoles}
          userPermissions={userPermissions}
          children={<div className="p-4 bg-green-100 rounded">Protected Content</div>}
        />
      </div>
    );
  },
  args: {
    showRoleInfo: true,
  },
};

export const EnterpriseExample: Story = {
  args: {
    allowedRoles: [ROLES.ADMIN, ROLES.EVENT_ORGANIZER, ROLES.ANALYST],
    userRoles: [ROLES.EVENT_ORGANIZER],
    requiredPermissions: [PERMISSIONS.MANAGE_EVENTS, PERMISSIONS.VIEW_ANALYTICS],
    userPermissions: [PERMISSIONS.MANAGE_EVENTS],
    unauthorizedMessage: 'Enterprise Access Required',
    unauthorizedDescription: 'This feature requires enterprise-level access. Please upgrade your plan or contact your administrator.',
    showRoleInfo: true,
    children: <div className="p-4 bg-green-100 rounded">Enterprise Dashboard</div>,
  },
};

export const Minimal: Story = {
  args: {
    allowedRoles: [ROLES.USER],
    userRoles: [ROLES.USER],
    showRoleInfo: false,
    unauthorizedMessage: 'Access Denied',
    children: <div className="p-4 bg-green-100 rounded">User Content</div>,
  },
};
