/**
 * The bun preload (`test-setup.ts`) wraps `globalThis.fetch` so a test that forgets to stub it can never reach the
 * real AI hosts (fal.run, generativelanguage.googleapis.com) from a sandbox or CI.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import type { Server } from 'bun';

const GUARD_HINT = 'stub fetch in this test';

const rejection = async (call: () => Promise<unknown>): Promise<Error> => {
    try {
        await call();
    } catch (error) {
        return error as Error;
    }

    throw new Error('fetch resolved, expected the guard to reject');
};

describe('test-setup fetch guard', () => {
    let server: Server;

    beforeAll(() => {
        server = Bun.serve({ port: 0, fetch: () => new Response('local body') });
    });

    afterAll(async () => {
        await server.stop(true);
    });

    it('rejects fetch to fal.run, naming the host and telling the test to stub fetch', async () => {
        const error = await rejection(() => fetch('https://fal.run/fal-ai/flux/schnell'));

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('fal.run');
        expect(error.message).toContain(GUARD_HINT);
    });

    it('rejects fetch to generativelanguage.googleapis.com, naming the host and telling the test to stub fetch', async () => {
        const error = await rejection(() => fetch('https://generativelanguage.googleapis.com/v1beta/models'));

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('generativelanguage.googleapis.com');
        expect(error.message).toContain(GUARD_HINT);
    });

    it('rejects subdomains of fal.run', async () => {
        const error = await rejection(() => fetch('https://queue.fal.run/fal-ai/flux/requests/abc'));

        expect(error.message).toContain('queue.fal.run');
        expect(error.message).toContain(GUARD_HINT);
    });

    it('rejects URL and Request inputs by their hostname', async () => {
        const fromUrl = await rejection(() => fetch(new URL('https://fal.run/fal-ai/flux/schnell')));

        const fromRequest = await rejection(() =>
            fetch(new Request('https://generativelanguage.googleapis.com/v1beta/models', { method: 'POST' }))
        );

        expect(fromUrl.message).toContain('fal.run');
        expect(fromUrl.message).toContain(GUARD_HINT);
        expect(fromRequest.message).toContain('generativelanguage.googleapis.com');
        expect(fromRequest.message).toContain(GUARD_HINT);
    });

    it('matches on the hostname, not on a substring of the URL', async () => {
        // URLs that merely mention a guarded host in the path or query go to the real fetch.
        for (const url of [
            `http://127.0.0.1:${server.port}/?next=https://fal.run/x`,
            `http://127.0.0.1:${server.port}/fal.run`,
            `http://localhost:${server.port}/generativelanguage.googleapis.com`,
        ]) {
            const response = await fetch(url);

            expect(await response.text()).toBe('local body');
        }

        // `notfal.run` ends with `fal.run` but is not a subdomain of it: the real fetch fails on its own terms.
        const lookalike = await fetch('http://notfal.run:1/', { signal: AbortSignal.timeout(3000) }).then(
            () => '',
            (error: Error) => error.message
        );

        expect(lookalike).not.toContain(GUARD_HINT);
    });

    it('lets a fetch to a local server through and returns its body', async () => {
        const response = await fetch(`http://127.0.0.1:${server.port}/`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('local body');
    });
});
