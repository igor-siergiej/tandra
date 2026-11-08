import type { Context, Next } from 'hono';
import { csrf } from 'hono/csrf';

/**
 * CSRF guard for `/api/*`. Better Auth session cookies mean the browser attaches credentials
 * to any request it makes to this origin, so a cross-site page can drive mutating routes unless
 * the origin is checked. Better Auth applies its own equivalent check inside `/api/auth/*`.
 *
 * `hono/csrf` deliberately treats a *missing* Content-Type as `text/plain` so an attacker
 * cannot dodge the check by stripping the header — that default is what stops content-type
 * sniffing. The cost is that a bodyless POST/PUT/DELETE, which sends no Content-Type at all,
 * reads as a "simple request" and is rejected unless it carries a same-origin Origin. Several
 * of our own routes take no body on those verbs (issue an invite, revoke it, delete a list)
 * and browsers cannot attach a header to them, so those requests would be rejected outright.
 *
 * Hence this wrapper: only run the origin check when a Content-Type is actually present. A
 * genuine form post always carries one, and a request without one has no body for a browser
 * to submit cross-site in the first place.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfForFormPosts = (allowedOrigins: Array<string>) => {
    const checkOrigin = csrf({ origin: allowedOrigins });
    return async (c: Context, next: Next) => {
        if (c.req.header('content-type')) return checkOrigin(c, next);
        // A bodyless request still changes state (copy a recipe, issue an invite), and a cross-site page can send one
        // with `fetch(..., { method: 'POST', mode: 'no-cors' })`. Browsers always attach Origin to those, so refuse
        // one that names a foreign origin; a request without Origin is not from a browser page.
        const origin = c.req.header('origin');
        if (!SAFE_METHODS.has(c.req.method) && origin && !allowedOrigins.includes(origin)) {
            return c.text('Forbidden', 403);
        }
        return next();
    };
};
