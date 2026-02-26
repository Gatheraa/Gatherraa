export interface RateLimitEntry {
  /** Sorted list of request timestamps (sliding window) */
  timestamps: number[];
  /** Total hit count in current window */
  count: number;
}

export interface RateLimitStore {
  /**
   * Record a new request hit and return the current window state.
   * The store is responsible for pruning timestamps outside the window.
   */
  hit(key: string, windowMs: number): Promise<RateLimitEntry>;

  /** Remove all entries for a key (e.g. after successful login) */
  reset(key: string): Promise<void>;

  /** Clean up resources (called on module destroy) */
  close?(): Promise<void>;
}