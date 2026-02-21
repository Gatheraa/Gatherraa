'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Star } from 'lucide-react';

interface RatingDistribution {
  [key: number]: number;
}

interface RatingDisplayProps {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: RatingDistribution;
}

export default function RatingDisplay({
  averageRating,
  totalReviews,
  ratingDistribution,
}: RatingDisplayProps) {
  const chartData = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: ratingDistribution[rating] || 0,
    percentage:
      totalReviews > 0
        ? Math.round(((ratingDistribution[rating] || 0) / totalReviews) * 100)
        : 0,
  }));

  const COLORS = ['#fbbf24', '#fbbf24', '#fbbf24', '#fbbf24', '#fbbf24'];

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Average Rating */}
        <div className="flex-shrink-0">
          <div className="text-center">
            <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
              {averageRating.toFixed(1)}
            </div>
            <div className="mb-2">{renderStars(Math.round(averageRating))}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </div>
          </div>
        </div>

        {/* Rating Distribution Chart */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Rating Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis
                dataKey="rating"
                type="category"
                width={30}
                tick={{ fill: '#6b7280' }}
                tickFormatter={(value) => `${value} star${value !== 1 ? 's' : ''}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f3f4f6',
                }}
                labelStyle={{ color: '#f3f4f6' }}
                formatter={(value: number) => [`${value} reviews`, 'Count']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Rating Breakdown */}
          <div className="mt-4 space-y-2">
            {chartData.map((item) => (
              <div key={item.rating} className="flex items-center gap-3">
                <div className="w-12 text-sm text-gray-600 dark:text-gray-400">
                  {item.rating} star{item.rating !== 1 ? 's' : ''}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">
                      {item.count} ({item.percentage}%)
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
