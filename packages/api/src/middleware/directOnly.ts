import type { Context, Next } from 'hono';

// Every proxy in front of the api (Traefik, the web container's nginx, Cloudflare) adds at least one of these.
const PROXY_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip'];

/**
 * For endpoints meant for something on the same network (the Prometheus scrape), not for visitors. A request that
 * came in through a reverse proxy carries a forwarding header; a direct scrape over the container network does not.
 */
export const directOnly = async (c: Context, next: Next) => {
    if (PROXY_HEADERS.some((name) => c.req.header(name) !== undefined)) {
        return c.json({ error: 'Not found' }, 404);
    }
    return next();
};
