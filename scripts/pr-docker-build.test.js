import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const workflow = Bun.YAML.parse(read('.github/workflows/pr.yml'));
const kanban = JSON.parse(read('.kanban-cli.json'));
const readme = read('README.md');

const IMAGES = ['Dockerfile.api', 'Dockerfile.web'];

const asList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// The check name GitHub reports for a job is its `name`, falling back to its id.
const checkName = (id, job) => job.name ?? id;

// Jobs of pr.yml that build one of the images.
const imageJobs = () =>
    Object.entries(workflow.jobs)
        .map(([id, job]) => ({ id, job, name: checkName(id, job) }))
        .filter(({ job }) => IMAGES.some((file) => JSON.stringify(job).includes(file)));

// Steps of a job that build a given image (by Dockerfile name).
const stepsBuilding = (job, file) => asList(job.steps).filter((step) => JSON.stringify(step).includes(file));

const buildSteps = () =>
    imageJobs().flatMap(({ job }) =>
        IMAGES.flatMap((file) => stepsBuilding(job, file).map((step) => ({ file, step })))
    );

const readmeCiSection = () => {
    const start = readme.indexOf('## CI/CD');
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = readme.slice(start + '## CI/CD'.length);
    const next = rest.search(/^## /m);

    return next === -1 ? rest : rest.slice(0, next);
};

describe('PR workflow builds both Docker images', () => {
    it('has job(s) that build Dockerfile.api and Dockerfile.web', () => {
        const built = new Set(buildSteps().map(({ file }) => file));

        expect([...built].sort()).toEqual([...IMAGES].sort());
    });

    it('passes NODE_AUTH_TOKEN from secrets.GH_TOKEN as a build arg to every image build, as CD does', () => {
        const steps = buildSteps();
        expect(steps.length).toBeGreaterThan(0);

        for (const { file, step } of steps) {
            const text = JSON.stringify(step);
            expect({ file, hasToken: text.includes('NODE_AUTH_TOKEN') }).toEqual({ file, hasToken: true });
            expect({ file, usesGhToken: text.includes('secrets.GH_TOKEN') }).toEqual({ file, usesGhToken: true });
        }
    });

    it('never pushes the images', () => {
        const jobs = imageJobs();
        expect(jobs.length).toBeGreaterThan(0);

        for (const { name, job } of jobs) {
            const text = JSON.stringify(job);
            expect({ name, login: text.includes('docker/login-action') }).toEqual({ name, login: false });
            expect({ name, cliPush: /docker\s+push|--push|publish-images/.test(text) }).toEqual({
                name,
                cliPush: false,
            });

            for (const step of asList(job.steps)) {
                const push = step.with?.push;
                expect({ name, push: push === true || push === 'true' }).toEqual({ name, push: false });
            }
        }
    });

    it('uses the buildx GitHub Actions cache for every image build', () => {
        const steps = buildSteps();
        expect(steps.length).toBeGreaterThan(0);

        for (const { file, step } of steps) {
            const text = JSON.stringify(step);
            expect({ file, cacheFrom: /cache-from.{0,20}type=gha/.test(text) }).toEqual({ file, cacheFrom: true });
            expect({ file, cacheTo: /cache-to.{0,20}type=gha/.test(text) }).toEqual({ file, cacheTo: true });
        }
    });

    it('skips cleanly for Dependabot, like semgrep, because it cannot read the Actions secrets', () => {
        const jobs = imageJobs();
        expect(jobs.length).toBeGreaterThan(0);

        for (const { name, job } of jobs) {
            expect({ name, condition: String(job.if ?? '') }).toEqual({
                name,
                condition: expect.stringContaining("github.actor != 'dependabot[bot]'"),
            });
        }
    });

    it('runs in parallel with the other jobs, gated on nothing but lint at most', () => {
        const jobs = imageJobs();
        expect(jobs.length).toBeGreaterThan(0);

        for (const { name, job } of jobs) {
            expect({ name, needs: asList(job.needs).filter((need) => need !== 'lint') }).toEqual({ name, needs: [] });
        }
    });
});

describe('required checks and docs list the image build check', () => {
    it('.kanban-cli.json ci.checkNamesRequired includes every image build job', () => {
        const jobs = imageJobs();
        expect(jobs.length).toBeGreaterThan(0);

        for (const { name } of jobs) {
            expect(kanban.ci.checkNamesRequired).toContain(name);
        }
    });

    it('README CI/CD section names every image build job', () => {
        const jobs = imageJobs();
        expect(jobs.length).toBeGreaterThan(0);

        const section = readmeCiSection();

        for (const { name } of jobs) {
            expect(section).toContain(`\`${name}\``);
        }
    });
});
