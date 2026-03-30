'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Medal, Award, User, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Types
interface LeaderboardUser {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  rank: number;
  previousRank?: number;
  coursesCompleted: number;
  quizScores: number[];
  badges: string[];
  joinDate: string;
  lastActive: string;
}

interface LeaderboardProps {
  users: LeaderboardUser[];
  currentUserId?: string;
  type: 'courses' | 'quizzes' | 'overall';
  pageSize?: number;
  showTrend?: boolean;
  showBadges?: boolean;
  className?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  users,
  currentUserId,
  type = 'overall',
  pageSize = 10,
  showTrend = true,
  showBadges = true,
  className = ''
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Sort users by score and rank
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => b.score - a.score).map((user, index) => ({
      ...user,
      rank: index + 1
    }));
  }, [users]);

  // Paginate users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedUsers.slice(startIndex, endIndex);
  }, [sortedUsers, currentPage, pageSize]);

  // Calculate trend
  const getTrend = (user: LeaderboardUser) => {
    if (!showTrend || !user.previousRank) return null;
    if (user.rank < user.previousRank) return 'up';
    if (user.rank > user.previousRank) return 'down';
    return 'same';
  };

  // Get rank icon
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-semibold text-gray-600">{rank}</span>;
  };

  // Get trend icon
  const getTrendIcon = (trend: string | null) => {
    if (!trend) return null;
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'same':
        return <Minus className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  // Get score label based on type
  const getScoreLabel = () => {
    switch (type) {
      case 'courses':
        return 'Courses';
      case 'quizzes':
        return 'Quiz Score';
      case 'overall':
        return 'Points';
      default:
        return 'Score';
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsLoading(false);
    }, 300);
  };

  // Get current user's position
  const currentUserPosition = useMemo(() => {
    if (!currentUserId) return null;
    return sortedUsers.find(user => user.id === currentUserId);
  }, [sortedUsers, currentUserId]);

  const totalPages = Math.ceil(sortedUsers.length / pageSize);

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-8 h-8" />
              Leaderboard
            </h2>
            <p className="text-blue-100 mt-1">
              Top performers by {getScoreLabel().toLowerCase()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{sortedUsers.length}</div>
            <div className="text-sm text-blue-100">Participants</div>
          </div>
        </div>
      </div>

      {/* Current User Card */}
      {currentUserPosition && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 p-4 m-4 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                {currentUserPosition.rank}
              </div>
              <div>
                <div className="font-semibold text-gray-900">Your Position</div>
                <div className="text-sm text-gray-600">{currentUserPosition.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{currentUserPosition.score}</div>
              <div className="text-sm text-gray-600">{getScoreLabel()}</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard List */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-8"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {paginatedUsers.map((user, index) => {
                const isCurrentUser = user.id === currentUserId;
                const trend = getTrend(user);
                
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className={`bg-white border rounded-lg p-4 cursor-pointer transition-all ${
                      isCurrentUser 
                        ? 'border-green-500 bg-green-50 shadow-md' 
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Rank */}
                        <div className="flex items-center justify-center w-8">
                          {getRankIcon(user.rank)}
                        </div>

                        {/* Avatar */}
                        <div className="relative">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          {trend && (
                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                              {getTrendIcon(trend)}
                            </div>
                          )}
                        </div>

                        {/* User Info */}
                        <div>
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            {user.name}
                            {isCurrentUser && (
                              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {user.coursesCompleted} courses • {user.quizScores.length} quizzes
                          </div>
                        </div>
                      </div>

                      {/* Score and Badges */}
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">{user.score}</div>
                        <div className="text-sm text-gray-600">{getScoreLabel()}</div>
                        
                        {showBadges && user.badges.length > 0 && (
                          <div className="flex gap-1 mt-1 justify-end">
                            {user.badges.slice(0, 3).map((badge, idx) => (
                              <Star key={idx} className="w-4 h-4 text-yellow-500 fill-current" />
                            ))}
                            {user.badges.length > 3 && (
                              <span className="text-xs text-gray-500">+{user.badges.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {selectedUser === user.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-gray-200"
                        >
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-gray-600">Join Date</div>
                              <div className="font-medium">{new Date(user.joinDate).toLocaleDateString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Last Active</div>
                              <div className="font-medium">{new Date(user.lastActive).toLocaleDateString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Average Quiz Score</div>
                              <div className="font-medium">
                                {user.quizScores.length > 0 
                                  ? Math.round(user.quizScores.reduce((a, b) => a + b, 0) / user.quizScores.length)
                                  : 'N/A'
                                }%
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-600">Badges Earned</div>
                              <div className="font-medium">{user.badges.length}</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedUsers.length)} of {sortedUsers.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="px-2 text-gray-500">...</span>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      currentPage === totalPages
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;

// Sample data for testing
export const sampleLeaderboardData: LeaderboardUser[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    score: 2450,
    rank: 1,
    previousRank: 2,
    coursesCompleted: 12,
    quizScores: [95, 88, 92, 87, 90],
    badges: ['Fast Learner', 'Quiz Master', 'Perfect Score'],
    joinDate: '2024-01-15',
    lastActive: '2024-03-28'
  },
  {
    id: '2',
    name: 'Bob Smith',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    score: 2380,
    rank: 2,
    previousRank: 1,
    coursesCompleted: 11,
    quizScores: [92, 85, 89, 91, 88],
    badges: ['Consistent', 'High Achiever'],
    joinDate: '2024-01-20',
    lastActive: '2024-03-27'
  },
  {
    id: '3',
    name: 'Carol Davis',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol',
    score: 2290,
    rank: 3,
    previousRank: 4,
    coursesCompleted: 10,
    quizScores: [88, 90, 85, 87, 89],
    badges: ['Dedicated', 'Quick Study'],
    joinDate: '2024-02-01',
    lastActive: '2024-03-28'
  },
  {
    id: '4',
    name: 'David Wilson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    score: 2150,
    rank: 4,
    previousRank: 3,
    coursesCompleted: 9,
    quizScores: [85, 87, 90, 82, 86],
    badges: ['Steady Progress'],
    joinDate: '2024-02-10',
    lastActive: '2024-03-26'
  },
  {
    id: '5',
    name: 'Emma Brown',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    score: 2080,
    rank: 5,
    previousRank: 6,
    coursesCompleted: 8,
    quizScores: [82, 85, 88, 84, 86],
    badges: ['Rising Star'],
    joinDate: '2024-02-15',
    lastActive: '2024-03-28'
  },
  {
    id: '6',
    name: 'Frank Miller',
    score: 1950,
    rank: 6,
    previousRank: 5,
    coursesCompleted: 7,
    quizScores: [80, 82, 85, 83, 81],
    badges: [],
    joinDate: '2024-02-20',
    lastActive: '2024-03-25'
  },
  {
    id: '7',
    name: 'Grace Taylor',
    score: 1820,
    rank: 7,
    previousRank: 8,
    coursesCompleted: 6,
    quizScores: [78, 80, 82, 79, 81],
    badges: ['Newcomer'],
    joinDate: '2024-03-01',
    lastActive: '2024-03-27'
  },
  {
    id: '8',
    name: 'Henry Anderson',
    score: 1750,
    rank: 8,
    previousRank: 7,
    coursesCompleted: 6,
    quizScores: [75, 78, 80, 77, 79],
    badges: [],
    joinDate: '2024-03-05',
    lastActive: '2024-03-24'
  }
];
