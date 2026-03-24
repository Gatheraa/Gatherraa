"use client";

import React from "react";
import { motion } from "motion/react";
import { User } from "lucide-react";

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
          <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 overflow-hidden">
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
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
