import type { Context, Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';

// JSON bodies are small (the largest is a recipe). Image uploads have their own, larger limit on their route.
const MAX_BODY_BYTES = 1024 * 1024;

const capped = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Request body is too large' }, 413),
});

export const limitRequestBodies = (c: Context, next: Next) =>
    c.req.path.endsWith('/image/upload') ? next() : capped(c, next);
