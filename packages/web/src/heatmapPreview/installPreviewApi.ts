import {
    PREVIEW_IMAGE_SVG,
    previewDiscoveryRecipe,
    previewDiscoverySearch,
    previewFriends,
    previewLabels,
    previewList,
    previewLists,
    previewMealPlan,
    previewRecipe,
    previewRecipes,
    previewSimilarDiscovery,
    previewTodos,
    previewUser,
} from './fixtures';

type Responder = (match: RegExpExecArray, url: URL) => Response;

const json = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const notAvailable = (): Response =>
    new Response(JSON.stringify({ error: 'Not available in the heatmap preview' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
    });

// Read-only routes the pages load on open. Anything else (writes, sockets, AI calls) gets a 404, so the
// preview never reaches the real api: it has no session there anyway, and must not create one.
const GET_ROUTES: Array<[RegExp, Responder]> = [
    [/^\/api\/auth\/get-session$/, () => json({ user: { id: previewUser.id, username: previewUser.username } })],
    [/^\/api\/auth\/list-accounts$/, () => json([])],
    [/^\/api\/lists\/user\/[^/]+$/, () => json(previewLists)],
    [/^\/api\/lists\/title\/[^/]+$/, () => json(previewList())],
    [/^\/api\/recipes$/, () => json(previewRecipes)],
    [/^\/api\/recipes\/([^/]+)$/, (m) => json(previewRecipe(decodeURIComponent(m[1])))],
    [/^\/api\/todos$/, () => json(previewTodos)],
    [/^\/api\/labels$/, () => json(previewLabels)],
    [
        /^\/api\/meal-plan$/,
        (_m, url) => json(previewMealPlan(url.searchParams.get('from'), url.searchParams.get('to'))),
    ],
    [/^\/api\/friends$/, () => json(previewFriends)],
    [/^\/api\/discover\/recipes$/, () => json(previewDiscoverySearch)],
    [/^\/api\/discover\/recipes\/[^/]+\/similar$/, () => json(previewSimilarDiscovery)],
    [/^\/api\/discover\/recipes\/([^/]+)$/, (m) => json(previewDiscoveryRecipe(decodeURIComponent(m[1])))],
    [/^\/api\/discover\/published$/, () => json([])],
    [/^\/api\/push\/vapid-public-key$/, () => json({ publicKey: null })],
    [/^\/api\/image\/.+$/, () => new Response(PREVIEW_IMAGE_SVG, { headers: { 'Content-Type': 'image/svg+xml' } })],
];

// Public, account-free answers the real api can give: feature flags decide which buttons a page shows.
const PASSTHROUGH: Record<string, true> = { '/api/features': true };

const urlOf = (input: RequestInfo | URL): URL =>
    new URL(input instanceof Request ? input.url : String(input), window.location.href);

const methodOf = (input: RequestInfo | URL, init?: RequestInit): string =>
    (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

const answerGet = (url: URL): Response => {
    for (const [pattern, responder] of GET_ROUTES) {
        const match = pattern.exec(url.pathname);

        if (match) return responder(match, url);
    }

    return notAvailable();
};

const respond = (url: URL, method: string): Response => {
    if (method === 'POST' && url.pathname === '/api/logs') return new Response(null, { status: 204 });

    return method === 'GET' ? answerGet(url) : notAvailable();
};

/** Serves the app's own `/api` from placeholder data; every other request goes out unchanged. */
export const installPreviewApi = (): void => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const url = urlOf(input);
        const ownApi = url.origin === window.location.origin && url.pathname.startsWith('/api/');

        if (!ownApi || PASSTHROUGH[url.pathname]) return realFetch(input, init);

        return respond(url, methodOf(input, init));
    };
};
