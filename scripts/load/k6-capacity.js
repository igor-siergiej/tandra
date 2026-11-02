/**
 * k6 capacity test for the tandra API. See scripts/load/README.md.
 *
 * Open-model stepped ramp: the arrival rate (user sessions/s) climbs through STEPS, each held for
 * STEP_DURATION. Every request is tagged with its step, so the summary shows p95 latency and error
 * rate per load level and names the last level that stayed inside the budget.
 *
 * Auth is the API's built-in Better Auth: setup() signs up throwaway fixture users via
 * /api/auth/sign-up/email and every request carries the returned session cookie.
 */
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const num = (name, fallback) => (__ENV[name] === undefined ? fallback : Number(__ENV[name]));

const seconds = (d) => {
    const m = /^(\d+)(s|m)$/.exec(d);

    if (!m) fail(`bad duration '${d}' (use e.g. 30s or 2m)`);

    return Number(m[1]) * (m[2] === 'm' ? 60 : 1);
};

const BASE_URL = (__ENV.BASE_URL ?? 'http://localhost:4101').replace(/\/$/, '');
const USERS = num('USERS', 50);
const LISTS_PER_USER = num('LISTS_PER_USER', 5);
const ITEMS_PER_LIST = num('ITEMS_PER_LIST', 15);
const BACKGROUND_LISTS = num('BACKGROUND_LISTS', 2000);
const MUTATION_SHARE = num('MUTATION_SHARE', 0.35);
const RECIPES_SHARE = num('RECIPES_SHARE', 0.5);
const RECIPES_PER_USER = num('RECIPES_PER_USER', 10);
const INGREDIENTS_PER_RECIPE = num('INGREDIENTS_PER_RECIPE', 8);
const BACKGROUND_RECIPES = num('BACKGROUND_RECIPES', 1000);
const STEPS = (__ENV.STEPS ?? '50,100,150,200,300,400,600').split(',').map(Number);
const STEP_DURATION = seconds(__ENV.STEP_DURATION ?? '30s');
const RAMP = 2;
const WARMUP_RATE = num('WARMUP_RATE', 10);
const WARMUP = seconds(__ENV.WARMUP ?? '15s');
const P95_MS = num('P95_MS', 300);
const ERROR_RATE = num('ERROR_RATE', 0.01);

// Steps with a target rate <= GATE_RATE get real thresholds (run exits 99 if the budget is breached).
// 0 (default) = pure measurement: the report names the cap but the exit code stays 0.
const GATE_RATE = num('GATE_RATE', 0);
const SAMPLE_EVERY = 5;

// Only local targets may be load tested: there is no staging deployment, and production must never be hit.
const ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal'];
const host = /^https?:\/\/([^/:]+)/.exec(BASE_URL)?.[1];

if (!ALLOWED_HOSTS.includes(host)) {
    fail(`refusing to load test '${BASE_URL}': host must be one of ${ALLOWED_HOSTS.join(', ')}`);
}

// Paths that cost money or hit third parties (fal.ai, recipe-page fetches). The script never calls
// them; teardown proves it from the server's own counters.
const FORBIDDEN_ROUTE = /\/api\/recipes\/import|\/image\/generate|\/api\/recipes\/substitutes/;

// The routes a session hits, as tagged on each request; the report prints a latency line for each.
const ROUTES = [
    'GET /api/lists/user/:userId',
    'GET /api/lists/title/:title',
    'GET /api/recipes',
    'GET /api/recipes/:recipeId',
    'PUT /api/lists/:title/items',
    'POST /api/lists/:title/items/:itemId',
    'DELETE /api/lists/:title/items/:itemId',
];

// Step windows on the test clock: warm-up first (untagged by step), then one window per step.
const stepWindows = [];
let cursor = WARMUP;

STEPS.forEach((rate, i) => {
    const length = RAMP + STEP_DURATION;
    stepWindows.push({ step: i + 1, rate, start: cursor, end: cursor + length });
    cursor += length;
});

const TOTAL_SECONDS = cursor;

const currentStep = () => {
    const t = exec.instance.currentTestRunDuration / 1000;
    const w = stepWindows.find((s) => t >= s.start && t < s.end);

    return w ? String(w.step) : 'warmup';
};

const stepThreshold = (rate) =>
    rate <= GATE_RATE ? { p95: [`p(95)<${P95_MS}`], failed: [`rate<${ERROR_RATE}`] } : { p95: [], failed: [] };

const thresholds = {
    // Safety valve: stop hammering a clearly dead server.
    http_req_failed: [{ threshold: 'rate<0.5', abortOnFail: true, delayAbortEval: '10s' }],
    ai_calls_detected: ['count==0'],
    ai_check_unavailable: ['count==0'],
};

for (const w of stepWindows) {
    const t = stepThreshold(w.rate);
    thresholds[`http_req_duration{step:${w.step}}`] = t.p95;
    thresholds[`http_req_failed{step:${w.step}}`] = t.failed;
    thresholds[`http_reqs{step:${w.step}}`] = [];
    thresholds[`api_cpu_cores{step:${w.step}}`] = [];
    thresholds[`api_eventloop_lag_p99_ms{step:${w.step}}`] = [];
    thresholds[`lost_updates{step:${w.step}}`] = [];
}

// Per-route latency is reported for one step below the cap, so routes (and runs) can be compared without the
// queueing noise of overloaded steps. Declared as thresholds so k6 keeps the sub-metric; no budget is attached.
const routeStep = (stepWindows.find((w) => w.rate === num('ROUTE_REPORT_RATE', 150)) ?? stepWindows[0]).step;

for (const name of ROUTES) thresholds[`http_req_duration{name:${name},step:${routeStep}}`] = [];

const sessionStages = [
    { target: WARMUP_RATE, duration: '1s' },
    { target: WARMUP_RATE, duration: `${WARMUP - 1}s` },
];

for (const w of stepWindows) {
    sessionStages.push({ target: w.rate, duration: `${RAMP}s` }, { target: w.rate, duration: `${STEP_DURATION}s` });
}

export const options = {
    scenarios: {
        sessions: {
            executor: 'ramping-arrival-rate',
            startRate: WARMUP_RATE,
            timeUnit: '1s',
            preAllocatedVUs: num('PRE_VUS', 100),
            maxVUs: num('MAX_VUS', 1000),
            stages: sessionStages,
            exec: 'session',
        },
        sampler: {
            executor: 'constant-vus',
            vus: 1,
            duration: `${TOTAL_SECONDS}s`,
            exec: 'sampler',
        },
    },
    thresholds,
    summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const aiCalls = new Counter('ai_calls_detected');
const aiCheckUnavailable = new Counter('ai_check_unavailable');

// A toggle/delete that gets 404 for an item the same session just added: the server lost the write.
const lostUpdates = new Counter('lost_updates');
const apiCpu = new Trend('api_cpu_cores');
const apiLag = new Trend('api_eventloop_lag_p99_ms');

http.setResponseCallback(http.expectedStatuses(200, 201, 204));

// Must be one of the API's trusted origins (BETTER_AUTH_URL), or Better Auth rejects the sign-up.
const ORIGIN = __ENV.AUTH_ORIGIN ?? 'http://localhost:4000';
const SESSION_COOKIE = 'better-auth.session_token';

// Better Auth limits sign-ups per client IP (3 per 10s), so each fixture user gets its own X-Forwarded-For.
const signUp = (username, n) => {
    const password = `k6-${username}-pw`;

    const res = http.post(
        `${BASE_URL}/api/auth/sign-up/email`,
        JSON.stringify({ email: `${crypto.randomUUID()}@users.invalid`, name: username, username, password }),
        {
            headers: {
                'Content-Type': 'application/json',
                Origin: ORIGIN,
                'X-Forwarded-For': `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`,
            },
            tags: { phase: 'seed' },
            redirects: 0,
        }
    );

    if (res.status !== 200) fail(`sign-up failed for ${username}: ${res.status} ${res.body}`);
    const cookie = res.cookies[SESSION_COOKIE]?.[0]?.value;

    if (!cookie) fail(`sign-up for ${username} returned no ${SESSION_COOKIE} cookie`);

    return { id: res.json('user.id'), token: `${SESSION_COOKIE}=${cookie}` };
};

const headers = (token) => ({ Cookie: token, 'Content-Type': 'application/json' });
const enc = encodeURIComponent;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const putList = (user, title) => [
    'PUT',
    `${BASE_URL}/api/lists`,
    JSON.stringify({ title, listType: 'shopping', dateAdded: new Date().toISOString() }),
    { headers: headers(user.token), tags: { phase: 'seed' } },
];

const putItem = (user, title, name) => [
    'PUT',
    `${BASE_URL}/api/lists/${enc(title)}/items`,
    JSON.stringify({ itemName: name, dateAdded: new Date().toISOString(), quantity: 1, unit: 'pcs' }),
    { headers: headers(user.token), tags: { phase: 'seed' } },
];

// Recipes are created with a client-chosen id so teardown can delete them without reading responses.
const putRecipe = (user, id) => [
    'PUT',
    `${BASE_URL}/api/recipes`,
    JSON.stringify({
        id,
        title: `Recipe ${id}`,
        ingredients: Array.from({ length: INGREDIENTS_PER_RECIPE }, (_, n) => ({
            name: `ingredient-${n}`,
            quantity: n + 1,
            unit: 'g',
        })),
        instructions: ['Mix.', 'Cook.'],
    }),
    { headers: headers(user.token), tags: { phase: 'seed' } },
];

const batched = (requests, size = 25) => {
    for (let i = 0; i < requests.length; i += size) {
        for (const res of http.batch(requests.slice(i, i + size))) {
            if (res.status !== 200 && res.status !== 201)
                fail(`seed request failed: ${res.status} ${res.url} ${res.body}`);
        }
    }
};

// Sums every sample of `metric` whose labels match `labelFilter`.
const sumMetric = (text, metric, labelFilter) => {
    let total = 0;

    for (const line of text.split('\n')) {
        if (!line.startsWith(`${metric}{`) && !line.startsWith(`${metric} `)) continue;

        if (labelFilter && !labelFilter.test(line)) continue;
        total += Number(line.slice(line.lastIndexOf(' ') + 1)) || 0;
    }

    return total;
};

const readMetrics = () => {
    const res = http.get(`${BASE_URL}/api/metrics`, { tags: { kind: 'sampler' } });

    return res.status === 200 ? res.body : null;
};

const aiCounters = (text) => ({
    forbiddenRoutes: sumMetric(text, 'tandra_api_http_requests_total', FORBIDDEN_ROUTE),
    imagesGenerated: sumMetric(text, 'tandra_images_generated_total'),
});

export function setup() {
    const runId = Date.now().toString(36);
    const health = http.get(`${BASE_URL}/api/health`);

    if (health.status !== 200) fail(`${BASE_URL}/api/health returned ${health.status}`);

    const users = [];

    for (let i = 0; i < USERS; i++) {
        users.push({ ...signUp(`k6_${runId}_u${i}`, i + 1), lists: [], recipes: [] });
    }

    const bg = { ...signUp(`k6_${runId}_bg`, USERS + 1), lists: [], recipes: [] };

    const baselineText = readMetrics();
    const baseline = baselineText ? aiCounters(baselineText) : null;

    // Each fixture list is owned by a throwaway fixture user, so no real user's data is read or written.
    const creates = [];

    for (const [ui, user] of users.entries()) {
        for (let li = 0; li < LISTS_PER_USER; li++) {
            const title = `k6-${runId}-u${ui}-l${li}`;
            user.lists.push(title);
            creates.push(putList(user, title));
        }
    }

    for (let n = 0; n < BACKGROUND_LISTS; n++) {
        const title = `k6-${runId}-bg-${n}`;
        bg.lists.push(title);
        creates.push(putList(bg, title));
    }

    for (const [ui, user] of users.entries()) {
        for (let n = 0; n < RECIPES_PER_USER; n++) {
            const id = `k6-${runId}-u${ui}-r${n}`;
            user.recipes.push(id);
            creates.push(putRecipe(user, id));
        }
    }

    for (let n = 0; n < BACKGROUND_RECIPES; n++) {
        const id = `k6-${runId}-bg-r${n}`;
        bg.recipes.push(id);
        creates.push(putRecipe(bg, id));
    }

    batched(creates);

    const items = [];

    for (const user of users) {
        for (const title of user.lists) {
            for (let n = 0; n < ITEMS_PER_LIST; n++) items.push(putItem(user, title, `item-${n}`));
        }
    }

    batched(items);

    console.log(
        `seeded ${users.length} users, ${creates.length} lists and recipes (${BACKGROUND_LISTS} background lists, ${BACKGROUND_RECIPES} background recipes), ${items.length} items; run ${runId}`
    );

    return { runId, users, bg, baseline };
}

export function session(data) {
    const step = currentStep();
    const user = pick(data.users);
    const params = (name) => ({ headers: headers(user.token), tags: { step, name } });

    const lists = http.get(`${BASE_URL}/api/lists/user/${enc(user.id)}`, params('GET /api/lists/user/:userId'));
    check(lists, { 'lists 200': (r) => r.status === 200 });

    const title = pick(user.lists);
    const listUrl = `${BASE_URL}/api/lists/title/${enc(title)}`;
    const list = http.get(listUrl, params('GET /api/lists/title/:title'));
    check(list, { 'list 200': (r) => r.status === 200 });

    if (Math.random() < RECIPES_SHARE) {
        http.get(`${BASE_URL}/api/recipes`, params('GET /api/recipes'));
        http.get(`${BASE_URL}/api/recipes/${enc(pick(user.recipes))}`, params('GET /api/recipes/:recipeId'));
    }

    if (Math.random() < MUTATION_SHARE) {
        const added = http.put(
            `${BASE_URL}/api/lists/${enc(title)}/items`,
            JSON.stringify({
                itemName: `k6-${exec.vu.idInTest}-${exec.scenario.iterationInTest}`,
                dateAdded: new Date().toISOString(),
            }),
            params('PUT /api/lists/:title/items')
        );

        if (added.status === 200) {
            const itemId = added.json('id');
            const itemUrl = `${BASE_URL}/api/lists/${enc(title)}/items/${enc(itemId)}`;
            // 404 is tolerated here and counted separately: it is a correctness bug, not capacity.
            const tolerate = (p) => ({ ...p, responseCallback: http.expectedStatuses(200, 404) });

            const toggled = http.post(
                itemUrl,
                JSON.stringify({ isSelected: true }),
                tolerate(params('POST /api/lists/:title/items/:itemId'))
            );

            const removed = http.del(itemUrl, null, tolerate(params('DELETE /api/lists/:title/items/:itemId')));

            for (const res of [toggled, removed]) if (res.status === 404) lostUpdates.add(1, { step });
        }

        http.get(listUrl, params('GET /api/lists/title/:title'));
    }
}

let lastSample = null;

export function sampler() {
    const text = readMetrics();

    if (text) {
        const cpu = sumMetric(text, 'tandra_api_process_cpu_seconds_total');
        const now = Date.now();
        const step = currentStep();

        if (lastSample && now > lastSample.at) {
            apiCpu.add((cpu - lastSample.cpu) / ((now - lastSample.at) / 1000), { step });
        }

        lastSample = { cpu, at: now };
        const lag = sumMetric(text, 'tandra_api_nodejs_eventloop_lag_p99_seconds');

        if (lag > 0) apiLag.add(lag * 1000, { step });
    }

    sleep(SAMPLE_EVERY);
}

export function teardown(data) {
    const owners = [...data.users, data.bg];
    const deletes = [];

    for (const owner of owners) {
        for (const title of owner.lists) {
            deletes.push(['DELETE', `${BASE_URL}/api/lists/${enc(title)}`, null, { headers: headers(owner.token) }]);
        }

        for (const id of owner.recipes) {
            deletes.push(['DELETE', `${BASE_URL}/api/recipes/${enc(id)}`, null, { headers: headers(owner.token) }]);
        }
    }

    let deleted = 0;

    for (let i = 0; i < deletes.length; i += 25) {
        for (const res of http.batch(deletes.slice(i, i + 25))) if (res.status === 200 || res.status === 204) deleted++;
    }

    console.log(`cleanup: deleted ${deleted}/${deletes.length} fixture lists and recipes`);

    // Prove the run spent nothing: the server's own counters must not have moved for the AI/import routes.
    const after = readMetrics();

    if (!(data.baseline && after)) {
        console.error('AI-call check UNAVAILABLE: /api/metrics unreachable, cannot prove zero fal.ai calls');
        aiCheckUnavailable.add(1);
        aiCalls.add(0);

        return;
    }

    const now = aiCounters(after);

    const delta = {
        forbiddenRoutes: now.forbiddenRoutes - data.baseline.forbiddenRoutes,
        imagesGenerated: now.imagesGenerated - data.baseline.imagesGenerated,
    };

    console.log(
        `AI-call check: import/generate/substitutes requests +${delta.forbiddenRoutes}, images generated +${delta.imagesGenerated}`
    );
    aiCheckUnavailable.add(0);
    aiCalls.add(delta.forbiddenRoutes + delta.imagesGenerated);
}

const pad = (v, n) => String(v).padStart(n);
const ms = (v) => (v === undefined ? '-' : v.toFixed(0));

export function handleSummary(data) {
    const m = data.metrics;
    const rows = [];
    let cap = null;
    let breached = null;

    for (const w of stepWindows) {
        const dur = m[`http_req_duration{step:${w.step}}`]?.values;
        const failed = m[`http_req_failed{step:${w.step}}`]?.values;
        const reqs = m[`http_reqs{step:${w.step}}`]?.values;
        const cpu = m[`api_cpu_cores{step:${w.step}}`]?.values;
        const lag = m[`api_eventloop_lag_p99_ms{step:${w.step}}`]?.values;
        const lost = m[`lost_updates{step:${w.step}}`]?.values.count ?? 0;

        if (!(dur && reqs)) continue; // run aborted before this step
        const rps = reqs.count / (w.end - w.start);
        const p95 = dur['p(95)'];
        const errRate = failed?.rate ?? 0;
        const ok = p95 < P95_MS && errRate < ERROR_RATE;

        if (ok && !breached) cap = { ...w, rps, p95 };

        if (!ok && !breached) breached = { ...w, rps, p95, errRate };
        rows.push(
            `${pad(w.step, 4)} ${pad(w.rate, 9)} ${pad(rps.toFixed(0), 8)} ${pad(ms(dur.med), 8)} ${pad(ms(p95), 8)} ${pad(ms(dur['p(99)']), 8)} ${pad((errRate * 100).toFixed(2), 7)} ${pad(lost, 6)} ${pad(cpu ? cpu.avg.toFixed(2) : '-', 9)} ${pad(lag ? ms(lag.max) : '-', 10)}  ${ok ? 'ok' : 'BREACH'}`
        );
    }

    const lines = [
        '',
        `tandra API capacity (auth: built-in Better Auth, target: ${BASE_URL})`,
        `budget: p95 < ${P95_MS} ms and error rate < ${(ERROR_RATE * 100).toFixed(1)}%; fixtures: ${USERS} users x (${LISTS_PER_USER} lists x ${ITEMS_PER_LIST} items + ${RECIPES_PER_USER} recipes) + ${BACKGROUND_LISTS} background lists + ${BACKGROUND_RECIPES} background recipes`,
        '',
        'step  sess/s(t)  req/s    p50 ms   p95 ms   p99 ms   err %   lost  api cores  lag p99 ms  verdict',
        ...rows,
        '',
        `per route at step ${routeStep} (${stepWindows[routeStep - 1].rate} sessions/s):`,
        '  route                                     p50 ms   p95 ms   p99 ms',
        ...ROUTES.map((name) => {
            const d = m[`http_req_duration{name:${name},step:${routeStep}}`]?.values;

            return d
                ? `  ${name.padEnd(40)} ${pad(ms(d.med), 8)} ${pad(ms(d['p(95)']), 8)} ${pad(ms(d['p(99)']), 8)}`
                : `  ${name.padEnd(40)} (no samples)`;
        }),
        '',
        cap
            ? `CAP: last step inside budget = ${cap.rate} sessions/s (~${cap.rps.toFixed(0)} req/s, p95 ${ms(cap.p95)} ms)`
            : 'CAP: not even the first step stayed inside budget',
        breached
            ? `FIRST BREACH: ${breached.rate} sessions/s (~${breached.rps.toFixed(0)} req/s): p95 ${ms(breached.p95)} ms, errors ${(breached.errRate * 100).toFixed(2)}%`
            : 'No step breached the budget: the cap is above the highest STEP, raise STEPS',
        `dropped iterations (k6 could not start sessions fast enough): ${m.dropped_iterations?.values.count ?? 0}`,
        `AI calls detected: ${m.ai_calls_detected?.values.count ?? 'n/a'} (check unavailable: ${m.ai_check_unavailable?.values.count ?? 'n/a'})`,
        '',
    ];

    const report = lines.join('\n');
    const out = { stdout: report };

    if (__ENV.REPORT_DIR) {
        out[`${__ENV.REPORT_DIR}/report.txt`] = report;
        out[`${__ENV.REPORT_DIR}/summary.json`] = JSON.stringify(data, null, 2);
    }

    return out;
}
