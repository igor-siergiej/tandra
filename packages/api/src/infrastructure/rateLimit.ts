/**
 * Simple IP-based rate limiter.
 * Tracks request counts per key and resets on a configurable interval.
 */
export class IpRateLimiter {
    private readonly counts = new Map<string, number>();

    constructor(private readonly limit: number) {}

    /**
     * Returns true if the request is allowed, false if rate limit is exceeded.
     * Increments the count for the given key when allowed.
     */
    isAllowed(key: string): boolean {
        const count = this.counts.get(key) ?? 0;

        if (count >= this.limit) return false;
        this.counts.set(key, count + 1);

        return true;
    }

    reset(): void {
        this.counts.clear();
    }
}

export interface RateLimitDecision {
    allowed: boolean;
    retryAfterSeconds: number;
}

/** Sliding-window limiter keyed by an arbitrary id (an authenticated user id, not a spoofable header). */
export class SlidingWindowLimiter {
    private readonly hits = new Map<string, Array<number>>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number
    ) {}

    check(key: string, now = Date.now()): RateLimitDecision {
        const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);

        if (recent.length >= this.limit) {
            this.hits.set(key, recent);

            return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + this.windowMs - now) / 1000) };
        }

        recent.push(now);
        this.hits.set(key, recent);

        return { allowed: true, retryAfterSeconds: 0 };
    }

    /** Drops keys with no hits left in the window; call periodically so idle users don't accumulate. */
    sweep(now = Date.now()): void {
        for (const [key, times] of this.hits) {
            if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
        }
    }
}
