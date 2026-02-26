import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Trophy, Star, Lock, CheckCircle } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  points: number;
  iconUrl?: string;
  isCompleted: boolean;
  progress: {
    current: number;
    target: number;
    percentage: number;
  };
}

interface UserAchievement {
  id: string;
  achievement: Achievement;
  status: string;
  progress: any;
  completedAt?: string;
}

export const AchievementsDashboard: React.FC = () => {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const response = await fetch('/api/gamification/achievements/user');
      const data = await response.json();
      setAchievements(data);
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors = {
      bronze: 'bg-amber-100 text-amber-800 border-amber-200',
      silver: 'bg-gray-100 text-gray-800 border-gray-200',
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      platinum: 'bg-purple-100 text-purple-800 border-purple-200',
      diamond: 'bg-blue-100 text-blue-800 border-blue-200',
      legendary: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[tier] || colors.bronze;
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'legendary':
        return <Trophy className="w-5 h-5 text-red-500" />;
      case 'diamond':
        return <Star className="w-5 h-5 text-blue-500" />;
      default:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
    }
  };

  const filteredAchievements = achievements.filter(ua => {
    if (filter === 'all') return true;
    if (filter === 'completed') return ua.status === 'completed';
    if (filter === 'in_progress') return ua.status === 'in_progress';
    return ua.achievement.category === filter;
  });

  const totalPoints = achievements
    .filter(ua => ua.status === 'completed')
    .reduce((sum, ua) => sum + ua.achievement.points, 0);

  const completedCount = achievements.filter(ua => ua.status === 'completed').length;
  const totalCount = achievements.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}/{totalCount}</div>
            <Progress value={(completedCount / totalCount) * 100} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7 days</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('completed')}
        >
          Completed
        </Button>
        <Button
          variant={filter === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('in_progress')}
        >
          In Progress
        </Button>
        <Button
          variant={filter === 'learning' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('learning')}
        >
          Learning
        </Button>
        <Button
          variant={filter === 'social' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('social')}
        >
          Social
        </Button>
        <Button
          variant={filter === 'events' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('events')}
        >
          Events
        </Button>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((userAchievement) => (
          <Card key={userAchievement.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {userAchievement.achievement.iconUrl ? (
                    <img
                      src={userAchievement.achievement.iconUrl}
                      alt={userAchievement.achievement.name}
                      className="w-8 h-8 rounded"
                    />
                  ) : (
                    getTierIcon(userAchievement.achievement.tier)
                  )}
                  <div>
                    <CardTitle className="text-sm">{userAchievement.achievement.name}</CardTitle>
                    <Badge className={`text-xs ${getTierColor(userAchievement.achievement.tier)}`}>
                      {userAchievement.achievement.tier}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {userAchievement.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium">{userAchievement.achievement.points}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                {userAchievement.achievement.description}
              </p>
              
              {userAchievement.status === 'in_progress' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {userAchievement.progress.current}/{userAchievement.progress.target}
                    </span>
                  </div>
                  <Progress value={userAchievement.progress.percentage} />
                </div>
              )}

              {userAchievement.status === 'completed' && userAchievement.completedAt && (
                <p className="text-xs text-green-600">
                  Completed on {new Date(userAchievement.completedAt).toLocaleDateString()}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {userAchievement.achievement.category}
                </Badge>
                {userAchievement.status === 'completed' && (
                  <Button variant="ghost" size="sm">
                    Share
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No achievements found</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'Start completing activities to unlock achievements!'
              : `No achievements found for filter: ${filter}`
            }
          </p>
        </div>
      )}
    </div>
  );
};
