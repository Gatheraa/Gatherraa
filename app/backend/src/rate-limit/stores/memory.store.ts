import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RateLimitEntry, RateLimitStore } from './store.interface';

@Injectable()
export class MemoryStore implements RateLimitStore, OnModuleDestroy {
  private readonly store = new Map<string, number[]>();
  private sweepInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Sweep stale keys every 5 minutes to prevent unbounded memory growth
    this.sweepInterval = setInterval(() => this.sweep(), 5 * 60_000);
  }

  async hit(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const cutoff = now - windowMs;

    const existing = this.store.get(key) ?? [];
    // Sliding window: discard timestamps outside the window
    const inWindow = existing.filter(ts => ts > cutoff);
    inWindow.push(now);

    this.store.set(key, inWindow);

    return {
      timestamps: inWindow,
      count: inWindow.length,
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.store.entries()) {
      // Remove keys with no recent activity (use a generous 1h window for sweeping)
      const recent = timestamps.filter(ts => ts > now - 60 * 60_000);
      if (recent.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, recent);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.sweepInterval);
  }

  async close(): Promise<void> {
    clearInterval(this.sweepInterval);
    this.store.clear();
  }
}