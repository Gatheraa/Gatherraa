import React, { useState, useCallback, useRef } from 'react';

interface ErrorRetryHandlerProps {
  errorMessage: string;
  onRetry: () => Promise<void>;
  maxRetries?: number;
  initialDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY = 1000; // 1 second

export const ErrorRetryHandler: React.FC<ErrorRetryHandlerProps> = ({
  errorMessage,
  onRetry,
  maxRetries = DEFAULT_MAX_RETRIES,
  initialDelayMs = DEFAULT_INITIAL_DELAY,
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [autoRetrying, setAutoRetrying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const exponentialDelay = (attempt: number) => initialDelayMs * Math.pow(2, attempt);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setLastError(null);
    try {
      await onRetry();
      setRetryCount(0);
      setAutoRetrying(false);
    } catch (err: any) {
      setLastError(err?.message || 'Retry failed');
      setRetryCount((prev) => prev + 1);
      if (retryCount + 1 < maxRetries) {
        setAutoRetrying(true);
        const delay = exponentialDelay(retryCount + 1);
        timeoutRef.current = setTimeout(handleRetry, delay);
      } else {
        setAutoRetrying(false);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, retryCount, maxRetries, initialDelayMs]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="error-retry-handler">
      <div className="animated-placeholder">
        {/* Simple animated SVG or shimmer */}
        <svg width="48" height="48" viewBox="0 0 48 48" className="error-icon-spin" aria-hidden="true">
          <circle cx="24" cy="24" r="20" stroke="#e53e3e" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4"/>
          <circle cx="24" cy="24" r="10" fill="#e53e3e" opacity="0.2"/>
        </svg>
      </div>
      <div className="error-message">
        {errorMessage}
        {lastError && <div className="last-error">{lastError}</div>}
      </div>
      <button
        className={`retry-btn${isRetrying ? ' retrying' : ''}`}
        onClick={handleRetry}
        disabled={isRetrying || autoRetrying}
        aria-busy={isRetrying || autoRetrying}
      >
        {isRetrying || autoRetrying ? 'Retrying...' : 'Retry'}
      </button>
      {retryCount > 0 && retryCount < maxRetries && (
        <div className="retry-info">
          Retrying in {Math.round(exponentialDelay(retryCount) / 1000)}s... (Attempt {retryCount + 1} of {maxRetries})
        </div>
      )}
      {retryCount >= maxRetries && (
        <div className="retry-info max-retries">Max retries reached. Please check your connection.</div>
      )}
      <style jsx>{`
        .error-retry-handler {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: #fff0f0;
          border-radius: 1rem;
          box-shadow: 0 2px 8px rgba(229, 62, 62, 0.08);
          min-width: 280px;
        }
        .animated-placeholder {
          margin-bottom: 1rem;
        }
        .error-icon-spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .error-message {
          color: #e53e3e;
          font-weight: 600;
          margin-bottom: 1rem;
          text-align: center;
        }
        .last-error {
          color: #b91c1c;
          font-size: 0.9em;
          margin-top: 0.5em;
        }
        .retry-btn {
          background: #e53e3e;
          color: #fff;
          border: none;
          border-radius: 0.5rem;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          outline: none;
        }
        .retry-btn:active {
          transform: scale(0.97);
        }
        .retry-btn.retrying {
          background: #c53030;
          animation: pulse 0.7s infinite alternate;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 #e53e3e44; }
          100% { box-shadow: 0 0 0 8px #e53e3e11; }
        }
        .retry-info {
          margin-top: 1rem;
          color: #b91c1c;
          font-size: 0.95em;
        }
        .retry-info.max-retries {
          color: #a0aec0;
        }
      `}</style>
    </div>
  );
};

export default ErrorRetryHandler;
