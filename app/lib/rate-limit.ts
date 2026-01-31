interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number; // For LRU tracking
}

interface RateLimiterMetrics {
  totalRequests: number;
  rejections: number;
  evictions: number;
  cleanups: number;
  currentEntries: number;
  capacityPercent: number;
}

class EnhancedRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  // Tiered capacity limits for graceful degradation
  private readonly SOFT_LIMIT = 5_000; // Start aggressive cleanup
  private readonly HARD_LIMIT = 8_000; // Warning threshold
  private readonly MAX_ENTRIES = 10_000; // Absolute maximum

  // More aggressive cleanup for single-server production
  private readonly CLEANUP_INTERVAL_MS = 30_000; // 30 seconds (was 60s)

  // Metrics for monitoring
  private metrics = {
    totalRequests: 0,
    rejections: 0,
    evictions: 0,
    cleanups: 0,
  };

  constructor() {
    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);

    // Unref to allow process to exit cleanly
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const beforeSize = this.store.size;
    let deletedCount = 0;

    // Delete expired entries (outside their time window)
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        deletedCount++;
      }
    }

    // Aggressive cleanup if approaching soft limit
    if (this.store.size > this.SOFT_LIMIT) {
      const additionalDeleted = this.aggressiveCleanup(now);
      deletedCount += additionalDeleted;
    }

    this.metrics.cleanups++;

    // Log cleanup results in development
    if (deletedCount > 0 && process.env.NODE_ENV === 'development') {
      console.log(
        `[Rate Limiter] Cleanup: deleted ${deletedCount} entries ` +
          `(${beforeSize} → ${this.store.size})`
      );
    }

    // Warning if consistently high usage
    if (this.store.size > this.HARD_LIMIT) {
      console.warn(
        `⚠️ [Rate Limiter] High usage: ${this.store.size}/${this.MAX_ENTRIES} entries ` +
          `(${Math.round((this.store.size / this.MAX_ENTRIES) * 100)}% capacity)`
      );
    }
  }

  private aggressiveCleanup(now: number): number {
    const beforeSize = this.store.size;

    // Strategy 1: Delete entries expiring in the next 2 minutes
    const soonToExpire = now + 120_000; // 2 minutes
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < soonToExpire) {
        this.store.delete(key);
      }
    }

    // Strategy 2: If still over soft limit, use LRU eviction
    if (this.store.size > this.SOFT_LIMIT) {
      const toDelete = this.store.size - this.SOFT_LIMIT;

      // Sort by lastAccess (oldest first) for LRU eviction
      const entries = Array.from(this.store.entries()).sort(
        (a, b) => a[1].lastAccess - b[1].lastAccess
      );

      // Delete oldest accessed entries
      for (let i = 0; i < toDelete && i < entries.length; i++) {
        this.store.delete(entries[i][0]);
        this.metrics.evictions++;
      }

      console.warn(
        `[Rate Limiter] Aggressive cleanup: evicted ${toDelete} LRU entries`
      );
    }

    return beforeSize - this.store.size;
  }

  check(
    identifier: string,
    limit: number,
    windowMs: number
  ): { success: boolean; limit: number; remaining: number; reset: number } {
    this.metrics.totalRequests++;

    // Normalize identifier to prevent variation attacks
    const normalizedId = this.normalizeIdentifier(identifier);

    // Hard limit enforcement - prevent memory exhaustion
    if (!this.store.has(normalizedId) && this.store.size >= this.MAX_ENTRIES) {
      console.error(
        `[Rate Limiter] At MAX_ENTRIES (${this.MAX_ENTRIES}). Emergency cleanup triggered.`
      );
      this.cleanup();

      // If still at max capacity after cleanup, reject request
      if (this.store.size >= this.MAX_ENTRIES) {
        this.metrics.rejections++;
        console.error(
          `[Rate Limiter] Capacity exhausted after cleanup. Rejecting request.`
        );
        throw new Error('Rate limiter capacity exceeded. Please try again later.');
      }
    }

    const now = Date.now();
    const entry = this.store.get(normalizedId);

    if (!entry || now > entry.resetTime) {
      // New time window or expired entry
      this.store.set(normalizedId, {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now,
      });

      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: now + windowMs,
      };
    }

    // Update last access timestamp for LRU tracking
    entry.lastAccess = now;

    if (entry.count >= limit) {
      // Rate limit exceeded
      this.metrics.rejections++;

      return {
        success: false,
        limit,
        remaining: 0,
        reset: entry.resetTime,
      };
    }

    // Increment count and update store
    entry.count++;
    this.store.set(normalizedId, entry);

    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      reset: entry.resetTime,
    };
  }

  /**
   * Normalize IP addresses to prevent variation attacks
   * - IPv6: Collapse consecutive zeros, lowercase
   * - IPv4: Trim whitespace
   */
  private normalizeIdentifier(identifier: string): string {
    const trimmed = identifier.trim();

    // IPv6 normalization
    if (trimmed.includes(':')) {
      // Convert to lowercase
      const lower = trimmed.toLowerCase();

      // If already using :: shorthand, ensure it's properly formatted
      if (lower.includes('::')) {
        // Already compressed - just ensure consistent case
        return lower;
      }

      // Expand and normalize: remove leading zeros from each segment
      const segments = lower.split(':');
      const normalized = segments
        .map((segment) => {
          // Remove leading zeros (but keep at least one digit)
          if (segment === '') return segment;
          return segment.replace(/^0+/, '') || '0';
        })
        .join(':');

      // Collapse consecutive zero segments to ::
      // Replace sequences of :0:0:0: with ::
      let compressed = normalized;

      // Find all sequences of consecutive :0: and replace the longest with ::
      const zeroPattern = /(:0)+/g;
      const matches = [...compressed.matchAll(zeroPattern)];

      if (matches.length > 0) {
        // Find the longest sequence
        let longest = matches[0];
        for (const match of matches) {
          if (match[0].length > longest[0].length) {
            longest = match;
          }
        }

        // Replace only the longest sequence with ::
        compressed =
          compressed.substring(0, longest.index!) +
          ':' +
          compressed.substring(longest.index! + longest[0].length);
      }

      return compressed;
    }

    // IPv4 or other identifier - just return trimmed
    return trimmed;
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): RateLimiterMetrics {
    return {
      ...this.metrics,
      currentEntries: this.store.size,
      capacityPercent: Math.round((this.store.size / this.MAX_ENTRIES) * 100 * 100) / 100,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   * Useful for testing or manual intervention
   */
  reset(identifier: string): void {
    const normalizedId = this.normalizeIdentifier(identifier);
    this.store.delete(normalizedId);
  }

  /**
   * Get health status of rate limiter
   */
  getHealth(): {
    healthy: boolean;
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    metrics: RateLimiterMetrics;
  } {
    const metrics = this.getMetrics();
    const size = this.store.size;

    if (size >= this.HARD_LIMIT) {
      return {
        healthy: false,
        status: 'critical',
        message: `Critical: ${size}/${this.MAX_ENTRIES} entries (${metrics.capacityPercent}%)`,
        metrics,
      };
    }

    if (size >= this.SOFT_LIMIT) {
      return {
        healthy: true,
        status: 'warning',
        message: `Warning: ${size}/${this.MAX_ENTRIES} entries (${metrics.capacityPercent}%)`,
        metrics,
      };
    }

    return {
      healthy: true,
      status: 'healthy',
      message: `Healthy: ${size}/${this.MAX_ENTRIES} entries (${metrics.capacityPercent}%)`,
      metrics,
    };
  }

  /**
   * Cleanup and destroy the rate limiter
   * Call this during graceful shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
    console.log('[Rate Limiter] Destroyed and cleaned up');
  }
}

// Singleton instance
const rateLimiter = new EnhancedRateLimiter();

/**
 * Check rate limit for an identifier (usually IP address)
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param options - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export function rateLimit(
  identifier: string,
  options: { limit: number; windowMs: number } = {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes default
  }
): { success: boolean; limit: number; remaining: number; reset: number } {
  return rateLimiter.check(identifier, options.limit, options.windowMs);
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or administrative overrides
 */
export function resetRateLimit(identifier: string): void {
  rateLimiter.reset(identifier);
}

/**
 * Get rate limiter metrics for monitoring
 */
export function getRateLimiterMetrics(): RateLimiterMetrics {
  return rateLimiter.getMetrics();
}

/**
 * Get rate limiter health status
 */
export function getRateLimiterHealth(): {
  healthy: boolean;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics: RateLimiterMetrics;
} {
  return rateLimiter.getHealth();
}

/**
 * Gracefully shutdown rate limiter
 * Call during process shutdown
 */
export function shutdownRateLimiter(): void {
  rateLimiter.destroy();
}

// Graceful shutdown on process termination
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    console.log('[Rate Limiter] SIGTERM received, shutting down gracefully...');
    shutdownRateLimiter();
  });

  process.on('SIGINT', () => {
    console.log('[Rate Limiter] SIGINT received, shutting down gracefully...');
    shutdownRateLimiter();
  });
}
