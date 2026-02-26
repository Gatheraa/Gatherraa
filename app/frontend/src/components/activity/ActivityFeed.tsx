import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { motion } from 'framer-motion';

interface ActivityItem {
  id: string;
  avatarUrl?: string;
  avatarFallback: string;
  timestamp: string;
  action: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ items }) => {
  return (
    <div className="activity-feed">
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="activity-item flex items-center space-x-4 p-4 border-b"
        >
          <Avatar>
            {item.avatarUrl ? (
              <AvatarImage src={item.avatarUrl} alt="Avatar" />
            ) : (
              <AvatarFallback>{item.avatarFallback}</AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <p className="text-sm text-gray-800">{item.action}</p>
            <span className="text-xs text-gray-500">{item.timestamp}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default ActivityFeed;