import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { 
  Target, 
  Clock, 
  Users, 
  Trophy, 
  Star, 
  Lock, 
  Play, 
  CheckCircle,
  Calendar,
  Zap
} from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  status: string;
  objectives: Array<{
    id: string;
    description: string;
    target: number;
    points: number;
    order: number;
    isRequired: boolean;
  }>;
  rewards: {
    points: number;
    tokens: number;
    badges?: string[];
    titles?: string[];
  };
  startsAt: string;
  endsAt: string;
  maxParticipants: number;
  currentParticipants: number;
  isFeatured: boolean;
  tags: string[];
  rating: number;
  ratingCount: number;
}

interface UserChallenge {
  id: string;
  challenge: Challenge;
  status: string;
  progress: {
    currentStep: number;
    completedObjectives: string[];
    overallProgress: number;
    timeSpent: number;
    lastActivity: string;
  };
  objectiveProgress: Record<string, {
    current: number;
    target: number;
    completed: boolean;
    completedAt?: string;
  }>;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  score: number;
}

export const ChallengesView: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
    fetchUserChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const response = await fetch('/api/gamification/challenges');
      const data = await response.json();
      setChallenges(data);
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserChallenges = async () => {
    try {
      const response = await fetch('/api/gamification/challenges/user');
      const data = await response.json();
      setUserChallenges(data);
    } catch (error) {
      console.error('Failed to fetch user challenges:', error);
    }
  };

  const enrollInChallenge = async (challengeId: string) => {
    try {
      const response = await fetch(`/api/gamification/challenges/${challengeId}/enroll`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchUserChallenges();
      }
    } catch (error) {
      console.error('Failed to enroll in challenge:', error);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      tutorial: 'bg-green-100 text-green-800 border-green-200',
      easy: 'bg-blue-100 text-blue-800 border-blue-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      hard: 'bg-orange-100 text-orange-800 border-orange-200',
      expert: 'bg-red-100 text-red-800 border-red-200',
      master: 'bg-purple-100 text-purple-800 border-purple-200',
      legendary: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[difficulty] || colors.medium;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'individual':
        return <Target className="w-4 h-4" />;
      case 'team':
        return <Users className="w-4 h-4" />;
      case 'guild':
        return <Star className="w-4 h-4" />;
      case 'competitive':
        return <Trophy className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      not_started: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.not_started;
  };

  const getUserChallenge = (challengeId: string) => {
    return userChallenges.find(uc => uc.challenge.id === challengeId);
  };

  const filteredChallenges = challenges.filter(challenge => {
    if (filter === 'all') return true;
    if (filter === 'enrolled') return getUserChallenge(challenge.id);
    if (filter === 'completed') {
      const uc = getUserChallenge(challenge.id);
      return uc && uc.status === 'completed';
    }
    return challenge.type === filter;
  });

  const formatTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Challenges</h2>
          <p className="text-gray-600">Test your skills and earn rewards</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{challenges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userChallenges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userChallenges.filter(uc => uc.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userChallenges.length > 0 
                ? Math.round((userChallenges.filter(uc => uc.status === 'completed').length / userChallenges.length) * 100)
                : 0}%
            </div>
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
          All Challenges
        </Button>
        <Button
          variant={filter === 'enrolled' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('enrolled')}
        >
          Enrolled
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('completed')}
        >
          Completed
        </Button>
        <Button
          variant={filter === 'individual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('individual')}
        >
          Individual
        </Button>
        <Button
          variant={filter === 'team' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('team')}
        >
          Team
        </Button>
        <Button
          variant={filter === 'guild' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('guild')}
        >
          Guild
        </Button>
      </div>

      {/* Challenges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChallenges.map((challenge) => {
          const userChallenge = getUserChallenge(challenge.id);
          const isEnrolled = !!userChallenge;
          const isCompleted = userChallenge?.status === 'completed';

          return (
            <Card key={challenge.id} className={`relative ${challenge.isFeatured ? 'border-2 border-yellow-400' : ''}`}>
              {challenge.isFeatured && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
                  <Zap className="w-3 h-3 inline mr-1" />
                  Featured
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{challenge.title}</CardTitle>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className={getDifficultyColor(challenge.difficulty)}>
                        {challenge.difficulty}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getTypeIcon(challenge.type)}
                        {challenge.type}
                      </Badge>
                      {isEnrolled && (
                        <Badge className={getStatusColor(userChallenge.status)}>
                          {userChallenge.status.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{challenge.description}</p>

                {/* Progress for enrolled challenges */}
                {isEnrolled && userChallenge.progress && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{Math.round(userChallenge.progress.overallProgress)}%</span>
                    </div>
                    <Progress value={userChallenge.progress.overallProgress} />
                    <div className="text-xs text-gray-500 mt-1">
                      {userChallenge.progress.completedObjectives.length} of {challenge.objectives.length} objectives completed
                    </div>
                  </div>
                )}

                {/* Objectives */}
                <div className="mb-4">
                  <h4 className="font-medium text-sm mb-2">Objectives:</h4>
                  <div className="space-y-1">
                    {challenge.objectives.slice(0, 3).map((objective) => {
                      const progress = userChallenge?.objectiveProgress?.[objective.id];
                      const isCompleted = progress?.completed || false;
                      
                      return (
                        <div key={objective.id} className="flex items-center gap-2 text-xs">
                          {isCompleted ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <div className="w-3 h-3 border border-gray-300 rounded-full" />
                          )}
                          <span className={isCompleted ? 'text-green-600' : 'text-gray-600'}>
                            {objective.description}
                          </span>
                          <span className="text-gray-400 ml-auto">+{objective.points} pts</span>
                        </div>
                      );
                    })}
                    {challenge.objectives.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{challenge.objectives.length - 3} more objectives
                      </div>
                    )}
                  </div>
                </div>

                {/* Rewards */}
                <div className="mb-4">
                  <h4 className="font-medium text-sm mb-2">Rewards:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <Trophy className="w-3 h-3 mr-1" />
                      {challenge.rewards.points} points
                    </Badge>
                    <Badge variant="outline">
                      <Star className="w-3 h-3 mr-1" />
                      {challenge.rewards.tokens} tokens
                    </Badge>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {challenge.currentParticipants}/{challenge.maxParticipants}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeRemaining(challenge.endsAt)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {challenge.rating.toFixed(1)} ({challenge.ratingCount})
                  </div>
                </div>

                {/* Action Button */}
                {!isEnrolled && (
                  <Button 
                    className="w-full" 
                    onClick={() => enrollInChallenge(challenge.id)}
                    disabled={challenge.currentParticipants >= challenge.maxParticipants}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Challenge
                  </Button>
                )}

                {isEnrolled && !isCompleted && (
                  <Button className="w-full" variant="outline">
                    Continue Challenge
                  </Button>
                )}

                {isCompleted && (
                  <Button className="w-full" variant="outline" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completed
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredChallenges.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No challenges found</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'Check back later for new challenges!'
              : `No challenges found for filter: ${filter}`
            }
          </p>
        </div>
      )}
    </div>
  );
};
