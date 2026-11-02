/**
 * Thin Umami tracker wrapper. Reads `analytics.{host,websiteId,enabled}` from
 * the runtime config (served at /config.json) and lazily injects the tracker
 * script `<host>/p.js` on first use (the Umami instance must set
 * `TRACKER_SCRIPT_NAME=p.js`). If `enabled` is false or the host is missing,
 * every method is a no-op — callers can fire events without sprinkling null
 * checks. Events fired while the script is still loading are held (up to
 * MAX_PENDING) and sent once it has; if it never loads (offline, blocked)
 * they are dropped.
 *
 * Every event carries `isGuest`, so guest trial use can be told apart from
 * account use. Payloads must never carry text the user typed (list titles,
 * item names, search terms): counts and enums only.
 *
 * Umami v3 script global API: `umami.track(event, data)`,
 * `umami.identify(id)`, `umami.startSessionReplay()`. The tracker only
 * installs `window.umami` if nothing else has, so this module must never
 * define it. The tracker also records page views itself (it patches
 * history.pushState), so `loadTracker()` only makes sure the script is loaded.
 *
 * Once the tracker has loaded, `<host>/recorder.js` follows. It records click
 * positions and scroll depth for Umami's heatmaps (and replay, if the website
 * settings ever turn it on). It sends nothing until the tracker has a session,
 * and is not loaded at all for visitors who opted out via Umami's own
 * `localStorage['umami.disabled']` flag.
 *
 * Both scripts POST to `<host>`, and every list page path in what they send is
 * rewritten to `/list/:list` (see `redactListPaths`). The recorder has no hook
 * of its own (it reads `location.href`), so the rewrite wraps `fetch` for those
 * two endpoints only.
 */
import { z } from 'zod';

import { readGuestFlag } from '../guest/guestFlag';
import { isHeatmapPreview } from '../heatmapPreview/isHeatmapPreview';
import { getConfig } from './config';

type EventPayload = Record<string, string | number | boolean | undefined>;

const MAX_PENDING = 50;

declare global {
    interface Window {
        umami?: {
            track: (event: string, data?: EventPayload) => void;
            identify: (id: string) => void;
            reset?: () => void;
            startSessionReplay?: () => void;
            stopSessionReplay?: () => void;
        };
    }
}

let injected = false;
let injectStarted = false;
let pending: Array<[string, EventPayload]> = [];

const flushPending = (): void => {
    const queued = pending;
    pending = [];

    for (const [event, data] of queued) window.umami?.track(event, data);
};

const appendScript = (src: string, websiteId: string, onLoad?: () => void): void => {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.websiteId = websiteId;
    script.src = src;

    if (onLoad) script.addEventListener('load', onLoad);
    document.head.appendChild(script);
};

const optedOut = (): boolean => {
    try {
        return Boolean(localStorage.getItem('umami.disabled'));
    } catch {
        return false;
    }
};

// `/list/<id>` and legacy `/list/<title>[/<id>]`. Titles are percent-encoded in a URL, so a segment can
// never contain a quote or backslash and the match cannot run past the end of a JSON string.
const LIST_PATH = /\/list\/[^/?#"\\\s]+(?:\/[^/?#"\\\s]+)?/g;

/**
 * Every list page becomes `/list/:list`: an old bookmarked URL can carry the list's own title, and
 * one shared path gives one heatmap for the list page instead of one per list. The heatmap preview
 * opens `/list/:list` like any other list (see `heatmapPreview`).
 */
const redactListPaths = (text: string): string => text.replace(LIST_PATH, '/list/:list');

const redactAnalyticsRequests = (base: string): void => {
    const endpoints = new Set([`${base}/p`, `${base}/api/record`]);
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
        // Both scripts post a JSON string to a string URL; a Request stringifies to `[object Request]` and is left alone.
        const body = z.string().safeParse(init?.body);

        if (!endpoints.has(String(input)) || !body.success) return realFetch(input, init);

        return realFetch(input, { ...init, body: redactListPaths(body.data) });
    };
};

const injectScript = (host: string, websiteId: string): void => {
    if (injected || injectStarted) return;

    if (typeof document === 'undefined') return;

    injectStarted = true;
    const base = host.replace(/\/$/, '');
    redactAnalyticsRequests(base);
    // Never pre-define window.umami: the tracker skips installing its API when
    // the global already exists, which would silently drop every event.
    appendScript(`${base}/p.js`, websiteId, () => {
        injected = true;
        flushPending();

        if (!optedOut()) appendScript(`${base}/recorder.js`, websiteId);
    });
};

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/** The tracker settings when analytics is on and the host is http(s); otherwise null. */
// One guard per config field; each is covered in analytics.test.ts.
// fallow-ignore-next-line complexity
const trackerConfig = (): { host: string; websiteId: string } | null => {
    // The dashboard's heatmap preview frame is the analyst, not a visitor: record nothing from it.
    if (isHeatmapPreview) return null;

    try {
        const a = getConfig().analytics;

        if (a?.enabled === false || !a?.host || !a.websiteId) return null;

        return HTTP_PROTOCOLS.has(new URL(a.host).protocol) ? { host: a.host, websiteId: a.websiteId } : null;
    } catch {
        // Config not loaded yet, or a malformed host.
        return null;
    }
};

const ensureInjected = (): boolean => {
    if (injected) return true;
    const c = trackerConfig();

    if (!c) return false;
    injectScript(c.host, c.websiteId);

    return true;
};

/**
 * Loads the tracker once the runtime config is in. Umami itself records the
 * initial view and every later history.pushState as a page view, so this
 * sends nothing of its own.
 */
export const loadTracker = (): void => {
    ensureInjected();
};

const send = (event: string, payload: EventPayload): void => {
    if (window.umami) window.umami.track(event, payload);
    else if (!injected && pending.length < MAX_PENDING) pending.push([event, payload]);
};

/**
 * Fire-and-forget event. Safe to call before config is loaded; the
 * wrapper is a no-op until then.
 */
export const track = (event: string, data?: EventPayload): void => {
    if (ensureInjected()) send(event, { ...data, isGuest: readGuestFlag() });
};

// fallow-ignore-next-line unused-export
export const identify = (id: string): void => {
    if (!ensureInjected()) return;
    window.umami?.identify(id);
};

/**
 * Start a session-replay session. Requires the opt-in consent in
 * #73. Sample rate is server-side, not here.
 */
// fallow-ignore-next-line unused-export
export const startReplay = (): void => {
    if (!ensureInjected()) return;
    window.umami?.startSessionReplay?.();
};

// fallow-ignore-next-line unused-export
export const stopReplay = (): void => {
    if (!ensureInjected()) return;
    window.umami?.stopSessionReplay?.();
};
