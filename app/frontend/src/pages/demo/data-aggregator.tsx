'use client';

import React, { useState } from 'react';
import MultiSourceDataAggregator from '../../components/data-aggregator/MultiSourceDataAggregator';
import { DataSource } from '../../types/data-aggregator';

const DataAggregatorDemo: React.FC = () => {
  const [selectedSources, setSelectedSources] = useState<string[]>(['users-api', 'events-api', 'analytics-api']);

  const mockDataSources: DataSource[] = [
    {
      id: 'users-api',
      name: 'Users API',
      endpoint: 'https://jsonplaceholder.typicode.com/users',
      priority: 1,
      timeout: 5000,
      retryCount: 2,
    },
    {
      id: 'events-api',
      name: 'Events API',
      endpoint: 'https://jsonplaceholder.typicode.com/posts',
      priority: 2,
      timeout: 8000,
      retryCount: 3,
    },
    {
      id: 'analytics-api',
      name: 'Analytics API',
      endpoint: 'https://jsonplaceholder.typicode.com/comments',
      priority: 3,
      timeout: 10000,
      retryCount: 1,
    },
    {
      id: 'invalid-api',
      name: 'Invalid API (for testing)',
      endpoint: 'https://invalid-endpoint.example.com/data',
      priority: 4,
      timeout: 3000,
      retryCount: 1,
    },
  ];

  const activeDataSources = mockDataSources.filter(source => selectedSources.includes(source.id));

  const handleDataAggregated = (data: any[]) => {
    console.log('Data aggregated:', data);
    
    const successCount = data.filter(d => d.status === 'success').length;
    const failureCount = data.filter(d => d.status === 'error').length;
    
    console.log(`Aggregation complete: ${successCount} successful, ${failureCount} failed`);
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Multi-Source Data Aggregator Demo
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            This component demonstrates fetching data from multiple APIs with partial failure handling,
            efficient loading states, and data normalization.
          </p>
          
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Sources Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockDataSources.map(source => (
                <div
                  key={source.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSources.includes(source.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  onClick={() => toggleSource(source.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{source.name}</h3>
                      <p className="text-sm text-gray-600">{source.endpoint}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">
                          Priority: {source.priority}
                        </span>
                        <span className="text-xs text-gray-500">
                          Timeout: {source.timeout}ms
                        </span>
                        <span className="text-xs text-gray-500">
                          Retries: {source.retryCount}
                        </span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full ${
                      selectedSources.includes(source.id)
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <MultiSourceDataAggregator
              dataSources={activeDataSources}
              onDataAggregated={handleDataAggregated}
              mergeStrategy="merge"
              autoRefresh={false}
              showDetailedStatus={true}
            />
          </div>
          
          <div>
            <MultiSourceDataAggregator
              dataSources={activeDataSources}
              onDataAggregated={handleDataAggregated}
              mergeStrategy="combine"
              autoRefresh={true}
              refreshInterval={15000}
              showDetailedStatus={false}
            />
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Features Demonstrated</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Multiple Data Sources</h3>
              <p className="text-sm text-gray-600">
                Fetches data from multiple API endpoints simultaneously with configurable priorities and timeouts.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Partial Failure Handling</h3>
              <p className="text-sm text-gray-600">
                Continues operation even when some data sources fail, providing detailed error information.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Data Normalization</h3>
              <p className="text-sm text-gray-600">
                Normalizes data from different sources with consistent structure and metadata.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Efficient Loading States</h3>
              <p className="text-sm text-gray-600">
                Shows real-time progress and status updates during data aggregation.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Auto-Refresh</h3>
              <p className="text-sm text-gray-600">
                Automatically refreshes data at configurable intervals.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Merge Strategies</h3>
              <p className="text-sm text-gray-600">
                Supports different data merging strategies (merge, override, combine).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataAggregatorDemo;
