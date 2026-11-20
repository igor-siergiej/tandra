import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const workflow = Bun.YAML.parse(readFileSync(join(root, '.github/workflows/pr.yml'), 'utf8'));
const kanban = JSON.parse(readFileSync(join(root, 'jott-config.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');

const jobs = workflow.jobs;
const WEB_TESTS = /@tandra\/web test/;
const API_TESTS = /@tandra\/api test/;

const stepRuns = (job) => (job.steps ?? []).map((step) => step.run ?? '');
const jobRuns = (job, pattern) => stepRuns(job).some((run) => pattern.test(run));
const jobIdsRunning = (pattern) => Object.keys(jobs).filter((id) => jobRuns(jobs[id], pattern));
const checkName = (id) => jobs[id].name ?? id;
const needsOf = (job) => [job.needs ?? []].flat();

// Every job `id` waits for, directly or through other jobs.
const upstream = (id, seen = new Set()) => {
    for (const dep of needsOf(jobs[id])) {
        if (!seen.has(dep)) {
            seen.add(dep);
            upstream(dep, seen);
        }
    }

    return seen;
};

const single = (pattern, what) => {
    const ids = jobIdsRunning(pattern);
    expect(ids, `exactly one job should run the ${what}`).toHaveLength(1);

    return ids[0];
};

// The web tests and the api tests must live in different jobs: the criteria about the
// "new job" only mean something once that job exists.
const splitJobs = () => {
    const web = single(WEB_TESTS, 'web tests');
    const api = single(API_TESTS, 'api tests');
    expect(web, 'web tests and api tests must not share a job').not.toBe(api);

    return { web, api };
};

// The "CI/CD" section of the README, up to the next `## ` heading.
const ciSection = () => {
    const start = readme.indexOf('\n## CI/CD');
    expect(start).toBeGreaterThan(-1);
    const rest = readme.slice(start + 1);
    const next = rest.indexOf('\n## ', 3);

    return next === -1 ? rest : rest.slice(0, next);
};

describe('pr.yml: web unit tests run apart from the api tests', () => {
    it('runs the web tests in a job with no service containers', () => {
        const { web } = splitJobs();

        expect(jobs[web].services).toBeUndefined();
        expect(jobRuns(jobs[web], API_TESTS)).toBe(false);
    });

    it('keeps the OpenSearch service on the api tests that need it', () => {
        const { api } = splitJobs();

        expect(jobs[api].services?.opensearch).toBeDefined();
        const apiStep = (jobs[api].steps ?? []).find((step) => API_TESTS.test(step.run ?? ''));
        expect(apiStep.env?.OPENSEARCH_TEST_URL).toBeTruthy();
    });

    it('runs the web job in parallel with the api job, neither waiting for the other', () => {
        const { web, api } = splitJobs();

        expect(upstream(web).has(api)).toBe(false);
        expect(upstream(api).has(web)).toBe(false);
    });

    it('still runs the type-check gate and the script tests somewhere in the PR workflow', () => {
        splitJobs();

        expect(jobIdsRunning(/bun run typecheck\b/).length).toBeGreaterThan(0);
        expect(jobIdsRunning(/bun run test:scripts\b/).length).toBeGreaterThan(0);
    });
});

describe('pr.yml: the 90% api coverage gate', () => {
    it('runs the gate at 90 after the api tests wrote lcov, in the job that runs them', () => {
        const { web, api } = splitJobs();
        const steps = jobs[api].steps ?? [];
        const apiIndex = steps.findIndex((step) => API_TESTS.test(step.run ?? ''));
        const gateIndex = steps.findIndex((step) => /scripts\/check-coverage\.js/.test(step.run ?? ''));

        expect(gateIndex, 'the gate step lives in the api job').toBeGreaterThan(apiIndex);
        expect(apiIndex).toBeGreaterThan(-1);
        expect(steps[apiIndex].run).toContain('--coverage');
        expect(steps[apiIndex].run).toContain('lcov');
        expect(steps[gateIndex].run).toMatch(/check-coverage\.js\s+packages\/api\/coverage\/lcov\.info\s+90\b/);
        // Nothing may let a failing gate pass or skip it.
        expect(steps[gateIndex]['continue-on-error']).toBeFalsy();
        expect(steps[gateIndex].if).toBeUndefined();
        expect(steps[apiIndex]['continue-on-error']).toBeFalsy();
        expect(jobs[api]['continue-on-error']).toBeFalsy();
        expect(jobRuns(jobs[web], /check-coverage\.js/)).toBe(false);
    });

    it('blocks a PR through a required check that depends on the api job', () => {
        const { api } = splitJobs();
        const required = kanban.ci.checkNamesRequired;

        const gating = Object.keys(jobs).filter(
            (id) => required.includes(checkName(id)) && (id === api || upstream(id).has(api))
        );

        expect(gating.length).toBeGreaterThan(0);
    });
});

describe('required checks and docs list the new job', () => {
    it('lists only checks that exist as jobs in pr.yml', () => {
        splitJobs();
        const names = Object.keys(jobs).map(checkName);

        for (const required of kanban.ci.checkNamesRequired) {
            expect(names, `required check "${required}" has no job`).toContain(required);
        }
    });

    it('requires the web tests, directly or through an aggregate job that always runs', () => {
        const { web, api } = splitJobs();
        const required = kanban.ci.checkNamesRequired;

        for (const id of [web, api]) {
            const direct = required.includes(checkName(id));

            const aggregate = Object.keys(jobs).some(
                (other) =>
                    required.includes(checkName(other)) &&
                    upstream(other).has(id) &&
                    String(jobs[other].if ?? '').includes('always()')
            );

            expect(direct || aggregate, `job "${id}" is not covered by a required check`).toBe(true);
        }
    });

    it('names the web test job in the README "CI/CD" section', () => {
        const { web } = splitJobs();
        const section = ciSection();

        expect(section).toContain(`\`${checkName(web)}\``);
    });

    it('names every required check in the README "CI/CD" section', () => {
        splitJobs();
        const section = ciSection();

        for (const required of kanban.ci.checkNamesRequired) {
            expect(section, `README CI/CD does not mention \`${required}\``).toContain(`\`${required}\``);
        }
    });
});
