import type { Logger } from '@imapps/api-utils';
import { errorHandler } from '@imapps/api-utils/hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface AppOptions {
    logger: Logger;
    allowedOrigins: string[];
}

// The shared factory logs raw request paths, which include legacy list titles and item image names.
export const createApp = ({ logger, allowedOrigins }: AppOptions) => {
    const app = new Hono();
    app.use(
        '*',
        cors({
            origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
            credentials: true,
            allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
        })
    );
    app.use('*', async (c, next) => {
        const started = Date.now();
        await next();
        const route = c.req.routePath;
        logger.info('HTTP request completed', {
            method: c.req.method,
            route: !route || route === '*' || route === '/*' ? 'unmatched' : route,
            status: c.res.status,
            durationMs: Date.now() - started,
        });
    });
    app.onError(errorHandler);

    return app;
};
