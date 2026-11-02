import { beforeEach, describe, expect, it } from 'bun:test';

import { IpRateLimiter, SlidingWindowLimiter } from './rateLimit';

describe('IpRateLimiter', () => {
    let limiter: IpRateLimiter;

    beforeEach(() => {
        limiter = new IpRateLimiter(3);
    });

    describe('isAllowed', () => {
        it('allows requests below the limit', () => {
            expect(limiter.isAllowed('1.2.3.4')).toBe(true);
            expect(limiter.isAllowed('1.2.3.4')).toBe(true);
            expect(limiter.isAllowed('1.2.3.4')).toBe(true);
        });

        it('blocks requests at or above the limit', () => {
            limiter.isAllowed('1.2.3.4');
            limiter.isAllowed('1.2.3.4');
            limiter.isAllowed('1.2.3.4');

            expect(limiter.isAllowed('1.2.3.4')).toBe(false);
        });

        it('tracks counts independently per key', () => {
            limiter.isAllowed('1.1.1.1');
            limiter.isAllowed('1.1.1.1');
            limiter.isAllowed('1.1.1.1');

            // Different key should still be allowed
            expect(limiter.isAllowed('2.2.2.2')).toBe(true);
            // Same key should now be blocked
            expect(limiter.isAllowed('1.1.1.1')).toBe(false);
        });

        it('returns false immediately for a blocked key without incrementing further', () => {
            limiter.isAllowed('x');
            limiter.isAllowed('x');
            limiter.isAllowed('x');
            // Now blocked
            expect(limiter.isAllowed('x')).toBe(false);
            expect(limiter.isAllowed('x')).toBe(false);
        });

        it('starts at count 0 for unknown keys', () => {
            expect(limiter.isAllowed('new-key')).toBe(true);
        });
    });

    describe('reset', () => {
        it('clears all counts so requests are allowed again', () => {
            limiter.isAllowed('1.2.3.4');
            limiter.isAllowed('1.2.3.4');
            limiter.isAllowed('1.2.3.4');
            expect(limiter.isAllowed('1.2.3.4')).toBe(false);

            limiter.reset();

            expect(limiter.isAllowed('1.2.3.4')).toBe(true);
        });

        it('clears counts for all tracked keys', () => {
            limiter.isAllowed('a');
            limiter.isAllowed('a');
            limiter.isAllowed('a');
            limiter.isAllowed('b');
            limiter.isAllowed('b');
            limiter.isAllowed('b');

            limiter.reset();

            expect(limiter.isAllowed('a')).toBe(true);
            expect(limiter.isAllowed('b')).toBe(true);
        });
    });
});

describe('SlidingWindowLimiter', () => {
    it('allows up to the limit then blocks with a retry hint', () => {
        const limiter = new SlidingWindowLimiter(2, 60_000);

        expect(limiter.check('u1', 0).allowed).toBe(true);
        expect(limiter.check('u1', 1_000).allowed).toBe(true);

        const blocked = limiter.check('u1', 10_000);
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfterSeconds).toBe(50);
    });

    it('frees a slot once the oldest hit leaves the window', () => {
        const limiter = new SlidingWindowLimiter(1, 60_000);
        limiter.check('u1', 0);

        expect(limiter.check('u1', 59_999).allowed).toBe(false);
        expect(limiter.check('u1', 60_000).allowed).toBe(true);
    });

    it('keeps users independent', () => {
        const limiter = new SlidingWindowLimiter(1, 60_000);
        limiter.check('u1', 0);

        expect(limiter.check('u2', 0).allowed).toBe(true);
    });

    it('does not count blocked attempts against the user', () => {
        const limiter = new SlidingWindowLimiter(1, 60_000);
        limiter.check('u1', 0);
        limiter.check('u1', 30_000);
        limiter.check('u1', 40_000);

        expect(limiter.check('u1', 60_000).allowed).toBe(true);
    });

    it('sweep drops idle users', () => {
        const limiter = new SlidingWindowLimiter(1, 60_000);
        limiter.check('u1', 0);
        limiter.sweep(120_000);

        expect(limiter.check('u1', 120_001).allowed).toBe(true);
    });
});
