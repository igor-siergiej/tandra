/**
 * One isolated app stack per Playwright worker: its own api process, web server, Mongo database and OpenSearch
 * alias, so a test's database wipe (see fixtures) or a Discover publish never touches another worker's data. Slot 0
 * keeps the historical :4000/:4001, `tandra_e2e` and `discovery-recipes`, so a single-worker run is unchanged.
 * E2E_PORT_BASE moves every port, e.g. for a second checkout running its own suite.
 */
export const E2E_WORKERS = Number(process.env.E2E_WORKERS ?? 1);
const PORT_BASE = Number(process.env.E2E_PORT_BASE ?? 4000);

export interface Stack {
    webOrigin: string;
    webPort: number;
    apiBase: string;
    apiPort: number;
    dbName: string;
    discoveryIndex: string;
}

export const stackFor = (slot: number): Stack => {
    const webPort = PORT_BASE + slot * 10;
    const apiPort = webPort + 1;
    return {
        webOrigin: `http://localhost:${webPort}`,
        webPort,
        apiBase: `http://localhost:${apiPort}`,
        apiPort,
        dbName: slot === 0 ? 'tandra_e2e' : `tandra_e2e_${slot}`,
        discoveryIndex: slot === 0 ? 'discovery-recipes' : `e2e-${slot}-discovery-recipes`,
    };
};

/** Every slot, for code that runs outside a worker (global setup/teardown, the config). */
export const allStacks = (): Stack[] => Array.from({ length: E2E_WORKERS }, (_, slot) => stackFor(slot));

/** The stack of the worker this module is loaded in; Playwright sets TEST_PARALLEL_INDEX in every worker. */
export const currentStack = stackFor(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
