import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const pr = Bun.YAML.parse(read('.github/workflows/pr.yml'));
const cd = Bun.YAML.parse(read('.github/workflows/cd.yml'));
const e2eReadme = read('e2e/README.md');
const playwrightVersion = JSON.parse(read('package.json')).devDependencies['@playwright/test'];

const shard = pr.jobs['e2e-shard'];
const steps = shard.steps ?? [];
const runOf = (step) => step.run ?? '';
const stepIndex = (predicate) => steps.findIndex(predicate);

const containerImage = () => (typeof shard.container === 'string' ? shard.container : shard.container?.image);
const containerOptions = () => (typeof shard.container === 'string' ? '' : (shard.container?.options ?? ''));

const startsMongo = (step) => /mongo:\d/.test(runOf(step)) && /docker run/.test(runOf(step));
const startsOpenSearch = (step) => /opensearchproject\/opensearch/.test(runOf(step)) && /docker run/.test(runOf(step));
const installsDeps = (step) => /\bbun install\b/.test(runOf(step));
const runsE2e = (step) => /test:e2e/.test(runOf(step));

describe('pr.yml: e2e shards run in the Playwright container image', () => {
    it('runs the shards in the Playwright image whose tag matches the pinned @playwright/test version', () => {
        expect(containerImage()).toBe(`mcr.microsoft.com/playwright:v${playwrightVersion}-noble`);
    });

    it('no longer runs `playwright install` or `install-deps` in a shard', () => {
        expect(containerImage(), 'the browser must come from the container image').toBeDefined();

        for (const step of steps) {
            expect(runOf(step)).not.toMatch(/playwright\s+install/);
            expect(runOf(step)).not.toMatch(/install-deps/);
        }
    });

    it('no longer restores or saves a Playwright browser cache in a shard', () => {
        expect(containerImage(), 'the browser must come from the container image').toBeDefined();

        expect(JSON.stringify(steps)).not.toContain('ms-playwright');
    });

    it('drops the cd.yml job that warmed the browser cache nobody restores any more', () => {
        expect(containerImage(), 'the browser must come from the container image').toBeDefined();

        expect(cd.jobs['warm-playwright-cache']).toBeUndefined();
        expect(JSON.stringify(cd)).not.toContain('ms-playwright');
        expect(JSON.stringify(cd)).not.toMatch(/playwright\s+install/);
    });
});

describe('pr.yml: Mongo and OpenSearch still start in parallel with setup', () => {
    it('does not use `services:` for the shard (the ~55s blocking wait)', () => {
        expect(containerImage(), 'the shard must be a container job for this to matter').toBeDefined();

        expect(shard.services).toBeUndefined();
    });

    it('starts both containers in steps that come before `bun install`', () => {
        expect(containerImage(), 'the shard must be a container job for this to matter').toBeDefined();

        const mongo = stepIndex(startsMongo);
        const opensearch = stepIndex(startsOpenSearch);
        const install = stepIndex(installsDeps);

        expect(mongo, 'a step must `docker run` mongo').toBeGreaterThan(-1);
        expect(opensearch, 'a step must `docker run` opensearch').toBeGreaterThan(-1);
        expect(install).toBeGreaterThan(-1);
        expect(mongo).toBeLessThan(install);
        expect(opensearch).toBeLessThan(install);
    });

    it('only waits for them after setup, right before the tests run', () => {
        expect(containerImage(), 'the shard must be a container job for this to matter').toBeDefined();

        const install = stepIndex(installsDeps);
        const wait = stepIndex((step) => /mongosh|ping/.test(runOf(step)) && /_cluster\/health/.test(runOf(step)));
        const tests = stepIndex(runsE2e);

        expect(wait, 'a step must wait for Mongo and OpenSearch').toBeGreaterThan(-1);
        expect(wait).toBeGreaterThan(install);
        expect(wait).toBeLessThan(tests);
    });

    it('reaches the background containers from inside the job container', () => {
        expect(containerImage(), 'the shard must be a container job for this to matter').toBeDefined();

        const runStep = steps[stepIndex(runsE2e)];
        const urls = [runStep.env?.CONNECTION_URI, runStep.env?.E2E_OPENSEARCH_URL].filter(Boolean);
        expect(urls.length).toBeGreaterThan(0);

        // `localhost` inside a container is the container itself, unless it shares the host's network.
        const usesLocalhost = urls.some((url) => /\/\/([^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url));

        if (usesLocalhost) {
            expect(containerOptions()).toMatch(/--network[ =]host/);
        }
    });
});

describe('e2e/README.md: documents the Playwright image next to the patch regeneration', () => {
    it('says the container image tag must track @playwright/test', () => {
        expect(e2eReadme).toContain('mcr.microsoft.com/playwright');
    });
});
