import type { Browser, Page } from '@playwright/test';
import type { User } from '@tandra/types';

import { MOCK_USER, MOCK_USER_2, PASSWORDS } from './mocks/data/users';
import { currentStack } from './stack';

export const API_BASE = currentStack.apiBase;
const WEB_ORIGIN = currentStack.webOrigin;

// Better Auth rate-limits sign-in/sign-up per client IP (read from X-Forwarded-For). Every request in a
// test run comes from the same machine, so give each its own address or the suite trips the limit.
//
// The counter lives on globalThis, not in a module variable: Playwright gives each spec file its own
// module registry, so a module-level counter restarts at zero in every file and the suite hands the same
// addresses out again. The limit is 10 sign-ins per address per minute, so by the eleventh file every
// sign-in failed with 429 and the rest of the suite fell over. globalThis is shared by every spec file
// in the worker, so the addresses stay unique for the whole run.
const counterKey = Symbol.for('tandra.e2e.ipCounter');
const globalCounter = globalThis as unknown as Record<symbol, number>;
const nextClientIp = () => {
    globalCounter[counterKey] = (globalCounter[counterKey] ?? 0) + 1;
    const ipCounter = globalCounter[counterKey];
    return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
};

/** Routes the page's own sign-in/sign-up calls through a fresh client address each time. */
export const spreadAuthRateLimit = (page: Page) =>
    page.route('**/api/auth/**', (route) =>
        route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': nextClientIp() } })
    );

/** Signs `user` in against the api and returns the session cookie as `name=value`. */
const signInCookie = async (user: User = MOCK_USER): Promise<{ name: string; value: string }> => {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN, 'X-Forwarded-For': nextClientIp() },
        body: JSON.stringify({ username: user.username, password: PASSWORDS[user.username] }),
    });
    if (!res.ok) throw new Error(`sign-in as ${user.username} failed: ${res.status} ${await res.text()}`);
    const cookie = res.headers
        .getSetCookie()
        .map((line) => line.split(';')[0])
        .find((pair) => pair.startsWith('better-auth.session_token='));
    if (!cookie) throw new Error(`sign-in as ${user.username} set no session cookie`);
    const separator = cookie.indexOf('=');
    return { name: cookie.slice(0, separator), value: cookie.slice(separator + 1) };
};

/** Gives the page's browser context a signed-in session for `user`. */
export const signInAs = async (page: Page, user: User = MOCK_USER): Promise<void> => {
    const { name, value } = await signInCookie(user);
    await page.context().addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
};

/** A fresh browser context signed in as `user`, with images stubbed (they are never under test). */
export const openPageAs = async (browser: Browser, user: User): Promise<Page> => {
    const page = await (await browser.newContext()).newPage();
    await signInAs(page, user);
    await page.route(/\/api\/image\//, (route) =>
        route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('GIF89a', 'ascii') })
    );
    return page;
};

const sessions = new Map<string, Promise<{ name: string; value: string }>>();

/** Headers for a direct api call as `user`; one session per user per worker. */
export const sessionHeaders = async (user: User = MOCK_USER): Promise<Record<string, string>> => {
    if (!sessions.has(user.id)) sessions.set(user.id, signInCookie(user));
    const { name, value } = await (sessions.get(user.id) as Promise<{ name: string; value: string }>);
    return { 'Content-Type': 'application/json', Origin: WEB_ORIGIN, Cookie: `${name}=${value}` };
};

export { MOCK_USER, MOCK_USER_2 };
