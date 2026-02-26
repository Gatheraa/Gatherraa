import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Trophy, Medal, Crown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  rank: number;
  previousRank: number;
  rankChange: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
    avatarUrl?: string;
  };
  score: number;
  breakdown: Record<string, number>;
  isTied: boolean;
  tieCount: number;
}

interface Leaderboard {
  id: string;
  name: string;
  description: string;
  type: string;
  period: string;
}

export const LeaderboardView: React.FC = () => {
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<string>('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('weekly');

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  useEffect(() => {
    if (selectedLeaderboard) {
      fetchLeaderboardEntries(selectedLeaderboard);
    }
  }, [selectedLeaderboard, period]);

  const fetchLeaderboards = async () => {
    try {
      const response = await fetch('/api/gamification/leaderboards');
      const data = await response.json();
      setLeaderboards(data);
      if (data.length > 0) {
        setSelectedLeaderboard(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboardEntries = async (leaderboardId: string) => {
    try {
      const response = await fetch(`/api/gamification/leaderboards/${leaderboardId}?period=${period}&limit=50`);
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Failed to fetch leaderboard entries:', error);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <Trophy className="w-6 h-6 text-gray-300" />;
    }
  };

  const getRankChangeIcon = (change: number) => {
    if (change > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (change < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (rank === 3) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const formatScore = (score: number) => {
    if (score >= 1000000) {
      return `${(score / 1000000).toFixed(1)}M`;
    } else if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}K`;
    }
    return score.toString();
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
          <h2 className="text-2xl font-bold">Leaderboards</h2>
          <p className="text-gray-600">Compete with the community and climb the ranks</p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      {/* Leaderboard Selection */}
      <div className="flex flex-wrap gap-2">
        {leaderboards.map((leaderboard) => (
          <Button
            key={leaderboard.id}
            variant={selectedLeaderboard === leaderboard.id ? 'default' : 'outline'}
            onClick={() => setSelectedLeaderboard(leaderboard.id)}
          >
            {leaderboard.name}
          </Button>
        ))}
      </div>

      {/* Top 3 Podium */}
      {entries.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 2nd Place */}
          <Card className="relative">
            <CardHeader className="text-center pb-3">
              <div className="flex justify-center mb-2">
                {getRankIcon(2)}
              </div>
              <Badge className={`mx-auto ${getRankBadgeColor(2)}`}>
                2nd Place
              </Badge>
            </CardHeader>
            <CardContent className="text-center">
              <Avatar className="w-16 h-16 mx-auto mb-3">
                <AvatarImage src={entries[1]?.user.avatarUrl} />
                <AvatarFallback>
                  {entries[1]?.user.firstName?.[0]}{entries[1]?.user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold">
                {entries[1]?.user.firstName} {entries[1]?.user.lastName}
              </h3>
              <p className="text-2xl font-bold text-gray-600 mt-2">
                {formatScore(entries[1]?.score || 0)}
              </p>
            </CardContent>
          </Card>

          {/* 1st Place */}
          <Card className="relative border-2 border-yellow-400 shadow-lg">
            <CardHeader className="text-center pb-3">
              <div className="flex justify-center mb-2">
                {getRankIcon(1)}
              </div>
              <Badge className={`mx-auto ${getRankBadgeColor(1)}`}>
                1st Place
              </Badge>
            </CardHeader>
            <CardContent className="text-center">
              <Avatar className="w-20 h-20 mx-auto mb-3">
                <AvatarImage src={entries[0]?.user.avatarUrl} />
                <AvatarFallback className="text-lg">
                  {entries[0]?.user.firstName?.[0]}{entries[0]?.user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-bold text-lg">
                {entries[0]?.user.firstName} {entries[0]?.user.lastName}
              </h3>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {formatScore(entries[0]?.score || 0)}
              </p>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          <Card className="relative">
            <CardHeader className="text-center pb-3">
              <div className="flex justify-center mb-2">
                {getRankIcon(3)}
              </div>
              <Badge className={`mx-auto ${getRankBadgeColor(3)}`}>
                3rd Place
              </Badge>
            </CardHeader>
            <CardContent className="text-center">
              <Avatar className="w-16 h-16 mx-auto mb-3">
                <AvatarImage src={entries[2]?.user.avatarUrl} />
                <AvatarFallback>
                  {entries[2]?.user.firstName?.[0]}{entries[2]?.user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold">
                {entries[2]?.user.firstName} {entries[2]?.user.lastName}
              </h3>
              <p className="text-2xl font-bold text-gray-600 mt-2">
                {formatScore(entries[2]?.score || 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Full Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 ${
                  index < 3 ? 'bg-gradient-to-r from-transparent to-yellow-50' : ''
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8 h-8">
                    {index < 3 ? (
                      getRankIcon(entry.rank)
                    ) : (
                      <span className="font-bold text-gray-600">#{entry.rank}</span>
                    )}
                  </div>
                  
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={entry.user.avatarUrl} />
                    <AvatarFallback>
                      {entry.user.firstName?.[0]}{entry.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h4 className="font-semibold">
                      {entry.user.firstName} {entry.user.lastName}
                      {entry.user.username && (
                        <span className="text-gray-500 ml-2">@{entry.user.username}</span>
                      )}
                    </h4>
                    {entry.isTied && (
                      <Badge variant="outline" className="text-xs">
                        Tied with {entry.tieCount - 1} others
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    {getRankChangeIcon(entry.rankChange)}
                    {entry.rankChange !== 0 && (
                      <span className={`text-sm ${
                        entry.rankChange > 0 ? 'text-green-600' : 
                        entry.rankChange < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {entry.rankChange > 0 ? '+' : ''}{entry.rankChange}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatScore(entry.score)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {Object.entries(entry.breakdown).slice(0, 2).map(([key, value]) => (
                        <span key={key} className="mr-2">
                          {key}: {formatScore(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {entries.length === 0 && (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No entries yet</h3>
              <p className="text-gray-600">Be the first to appear on this leaderboard!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
