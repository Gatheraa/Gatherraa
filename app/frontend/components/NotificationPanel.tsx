import React, { useState, useEffect } from 'react';
import { Transition } from '@headlessui/react';

interface Notification {
  id: string;
  title: string;
  message: string;
}

const NotificationPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Simulate fetching notifications
    const mockNotifications = [
      { id: '1', title: 'Welcome!', message: 'Thanks for joining us.' },
      { id: '2', title: 'Update', message: 'Your profile has been updated.' },
    ];
    setNotifications(mockNotifications);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 w-96 space-y-4">
      {notifications.map((notification) => (
        <Transition
          key={notification.id}
          show={true}
          enter="transition-opacity duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="bg-white shadow-lg rounded-lg p-4 border border-gray-200"
        >
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-gray-800">{notification.title}</h4>
              <p className="text-gray-600 text-sm">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </Transition>
      ))}
    </div>
  );
};

export default NotificationPanel;