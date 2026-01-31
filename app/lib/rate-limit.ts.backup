interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  // Safety limits to prevent memory exhaustion
  private readonly MAX_ENTRIES = 10_000; // Limit to 10k unique IPs (~1MB memory)
  private readonly CLEANUP_INTERVAL_MS = 60_000; // 1 minute (more frequent than before)

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  private cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    // Delete expired entries
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        deletedCount++;
      }
    }

    // If still over limit after cleanup, delete oldest entries (LRU-style)
    if (this.store.size > this.MAX_ENTRIES) {
      const entriesToDelete = this.store.size - this.MAX_ENTRIES;
      const sortedEntries = Array.from(this.store.entries()).sort(
        (a, b) => a[1].resetTime - b[1].resetTime
      ); // Oldest first

      for (let i = 0; i < entriesToDelete; i++) {
        this.store.delete(sortedEntries[i][0]);
      }

      console.warn(
        `Rate limiter exceeded MAX_ENTRIES (${this.MAX_ENTRIES}). ` +
          `Deleted ${entriesToDelete} oldest entries.`
      );
    }

    if (deletedCount > 0 && process.env.NODE_ENV === 'development') {
      console.log(`Rate limiter cleanup: deleted ${deletedCount} expired entries`);
    }
  }

  check(
    identifier: string,
    limit: number,
    windowMs: number
  ): { success: boolean; limit: number; remaining: number; reset: number } {
    // Enforce max entries on insertion
    if (!this.store.has(identifier) && this.store.size >= this.MAX_ENTRIES) {
      console.warn(
        `Rate limiter at capacity (${this.MAX_ENTRIES} entries). ` + `Running emergency cleanup...`
      );
      this.cleanup();

      // If still at capacity after cleanup, delete oldest entry
      if (this.store.size >= this.MAX_ENTRIES) {
        const oldestKey = Array.from(this.store.entries()).sort(
          (a, b) => a[1].resetTime - b[1].resetTime
        )[0][0];
        this.store.delete(oldestKey);
      }
    }

    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window or expired entry
      this.store.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: now + windowMs,
      };
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return {
        success: false,
        limit,
        remaining: 0,
        reset: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(identifier, entry);

    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      reset: entry.resetTime,
    };
  }

  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

export function rateLimit(
  identifier: string,
  options: { limit: number; windowMs: number } = {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  }
) {
  return rateLimiter.check(identifier, options.limit, options.windowMs);
}

export function resetRateLimit(identifier: string) {
  rateLimiter.reset(identifier);
}
