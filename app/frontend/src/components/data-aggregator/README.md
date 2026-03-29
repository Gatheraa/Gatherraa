# MultiSourceDataAggregator Component

A powerful React component that aggregates data from multiple API endpoints with built-in error handling, loading states, and data normalization capabilities.

## Features

- **Multiple Data Sources**: Fetch data from multiple API endpoints simultaneously
- **Partial Failure Handling**: Continues operation even when some data sources fail
- **Data Normalization**: Normalizes data from different sources with consistent structure
- **Efficient Loading States**: Real-time progress and status updates during aggregation
- **Auto-Refresh**: Automatically refreshes data at configurable intervals
- **Merge Strategies**: Supports different data merging strategies (merge, override, combine)
- **Retry Logic**: Built-in retry mechanism for failed requests
- **Timeout Management**: Configurable timeouts for each data source
- **Priority-based Ordering**: Process data sources based on priority levels

## Installation

The component is part of the frontend application. Ensure all dependencies are installed:

```bash
npm install
```

## Usage

### Basic Usage

```tsx
import MultiSourceDataAggregator from '@/components/data-aggregator/MultiSourceDataAggregator';
import { DataSource } from '@/types/data-aggregator';

const dataSources: DataSource[] = [
  {
    id: 'users-api',
    name: 'Users API',
    endpoint: 'https://api.example.com/users',
    priority: 1,
    timeout: 5000,
    retryCount: 2,
  },
  {
    id: 'events-api',
    name: 'Events API',
    endpoint: 'https://api.example.com/events',
    priority: 2,
    timeout: 8000,
    retryCount: 3,
  },
];

function App() {
  const handleDataAggregated = (data) => {
    console.log('Aggregated data:', data);
  };

  return (
    <MultiSourceDataAggregator
      dataSources={dataSources}
      onDataAggregated={handleDataAggregated}
      mergeStrategy="merge"
      showDetailedStatus={true}
    />
  );
}
```

### Advanced Usage with Hook

```tsx
import { useDataAggregation } from '@/hooks/useDataAggregation';

function DataDashboard() {
  const {
    data,
    isLoading,
    error,
    refetch,
    mergedData,
    successCount,
    failureCount,
    lastUpdated
  } = useDataAggregation({
    dataSources: [
      {
        id: 'analytics',
        name: 'Analytics API',
        endpoint: 'https://api.example.com/analytics',
        priority: 1,
        timeout: 5000,
        retryCount: 2,
      },
    ],
    mergeStrategy: 'combine',
    autoRefresh: true,
    refreshInterval: 30000,
    onSuccess: (data) => console.log('Success:', data),
    onError: (error) => console.error('Error:', error),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Data Dashboard</h2>
      <p>Success: {successCount}, Failures: {failureCount}</p>
      <p>Last updated: {lastUpdated?.toLocaleString()}</p>
      <button onClick={refetch}>Refresh</button>
      <pre>{JSON.stringify(mergedData, null, 2)}</pre>
    </div>
  );
}
```

## API Reference

### MultiSourceDataAggregator Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dataSources` | `DataSource[]` | **Required** | Array of data source configurations |
| `onDataAggregated` | `(data: AggregatedData[]) => void` | `undefined` | Callback function called when aggregation completes |
| `mergeStrategy` | `'merge' \| 'override' \| 'combine'` | `'merge'` | Strategy for merging data from multiple sources |
| `autoRefresh` | `boolean` | `false` | Enable automatic data refresh |
| `refreshInterval` | `number` | `30000` | Auto-refresh interval in milliseconds |
| `showDetailedStatus` | `boolean` | `false` | Show detailed status for each data source |

### DataSource Interface

```typescript
interface DataSource {
  id: string;                    // Unique identifier for the data source
  name: string;                  // Display name for the data source
  endpoint: string;              // API endpoint URL
  priority: number;              // Priority level (1-10, lower = higher priority)
  timeout?: number;              // Request timeout in milliseconds (default: 10000)
  retryCount?: number;           // Number of retry attempts (default: 2)
  headers?: Record<string, string>; // Custom headers for the request
}
```

### AggregatedData Interface

```typescript
interface AggregatedData {
  sourceId: string;              // ID of the data source
  data: any;                     // Fetched data (null if failed)
  timestamp: Date;               // Timestamp of the request
  status: 'success' | 'error' | 'pending'; // Request status
  error?: string;                // Error message (if failed)
  metadata?: {                   // Additional metadata
    responseTime?: number;        // Response time in milliseconds
    retryAttempts?: number;       // Number of retry attempts
    dataSize?: number;           // Size of the response data
  };
}
```

## Merge Strategies

### Merge (Default)
Combines data from multiple sources, merging objects with the same ID:

```typescript
// Source 1: [{ id: 1, name: 'John', age: 30 }]
// Source 2: [{ id: 1, name: 'John', city: 'NYC' }]
// Result: [{ id: 1, name: 'John', age: 30, city: 'NYC' }]
```

### Override
Combines all data, with later sources overriding earlier ones:

```typescript
// Source 1: [{ id: 1, name: 'John' }]
// Source 2: [{ id: 1, name: 'Jane' }]
// Result: [{ id: 1, name: 'Jane' }]
```

### Combine
Simply concatenates all data without any merging:

```typescript
// Source 1: [{ id: 1, name: 'John' }]
// Source 2: [{ id: 2, name: 'Jane' }]
// Result: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]
```

## Error Handling

The component provides comprehensive error handling:

- **Network Errors**: Handles connection failures, timeouts, and HTTP errors
- **Partial Failures**: Continues operation when some sources fail
- **Retry Logic**: Automatically retries failed requests with exponential backoff
- **Error Reporting**: Detailed error information for each failed source

## Performance Considerations

- **Parallel Requests**: All data sources are fetched in parallel for optimal performance
- **Request Cancellation**: Requests are cancelled when component unmounts
- **Memory Management**: Efficient data processing and cleanup
- **Debounced Refresh**: Prevents excessive refresh requests

## Styling

The component uses Tailwind CSS classes and can be customized through:

1. **CSS Override**: Override default styles with custom CSS
2. **Theme Support**: Supports light/dark themes through CSS variables
3. **Responsive Design**: Built-in responsive breakpoints

## Examples

### Real-time Dashboard

```tsx
function RealTimeDashboard() {
  return (
    <MultiSourceDataAggregator
      dataSources={[
        {
          id: 'sales',
          name: 'Sales Data',
          endpoint: '/api/sales',
          priority: 1,
          timeout: 3000,
          retryCount: 1,
        },
        {
          id: 'users',
          name: 'User Analytics',
          endpoint: '/api/users',
          priority: 2,
          timeout: 5000,
          retryCount: 2,
        },
      ]}
      autoRefresh={true}
      refreshInterval={15000}
      showDetailedStatus={true}
      onDataAggregated={(data) => {
        // Update charts and visualizations
        updateCharts(data);
      }}
    />
  );
}
```

### Error-tolerant Data Display

```tsx
function ErrorTolerantDisplay() {
  return (
    <MultiSourceDataAggregator
      dataSources={[
        {
          id: 'primary',
          name: 'Primary API',
          endpoint: 'https://primary-api.com/data',
          priority: 1,
          timeout: 5000,
          retryCount: 3,
        },
        {
          id: 'backup',
          name: 'Backup API',
          endpoint: 'https://backup-api.com/data',
          priority: 2,
          timeout: 8000,
          retryCount: 1,
        },
      ]}
      mergeStrategy="override"
      onDataAggregated={(data) => {
        const successfulData = data.filter(d => d.status === 'success');
        if (successfulData.length > 0) {
          // Display data from successful sources
          displayData(successfulData);
        }
      }}
    />
  );
}
```

## Testing

The component includes comprehensive test coverage:

```bash
# Run component tests
npm test -- data-aggregation

# Run with coverage
npm run test:coverage -- data-aggregation
```

## Contributing

When contributing to the MultiSourceDataAggregator component:

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure backward compatibility

## License

This component is part of the Gatheraa project and follows the same license terms.
