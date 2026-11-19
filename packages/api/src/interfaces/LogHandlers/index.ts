import type { Context } from 'hono';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import { clientIpFrom } from '../../infrastructure/clientIp';
import { IpRateLimiter } from '../../infrastructure/rateLimit';

interface FrontendLog {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: Record<string, unknown>;
    timestamp?: string;
    userAgent?: string;
    url?: string;
}

// The privacy notice promises front-end logs hold no list-item, recipe or transcript text, so the client's free-form
// `context` is reduced to these keys (ids, the error and the route); everything else is dropped.
const ALLOWED_CONTEXT_KEYS = [
    'userId',
    'listId',
    'itemId',
    'recipeId',
    'route',
    'error',
    'errorName',
    'errorMessage',
] as const;

const allowedContext = (context: FrontendLog['context']): Record<string, string | number | boolean> => {
    const kept: Record<string, string | number | boolean> = {};

    for (const key of ALLOWED_CONTEXT_KEYS) {
        const value = context?.[key];

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') kept[key] = value;
    }

    return kept;
};

const getLogger = () => dependencyContainer.resolve(DependencyToken.Logger);

// The web logger sends one POST per log line, so a busy realtime session legitimately bursts.
const RATE_LIMIT_PER_WINDOW = 300;
const RATE_LIMIT_WINDOW = 60000;
const rateLimiter = new IpRateLimiter(RATE_LIMIT_PER_WINDOW);

setInterval(() => {
    rateLimiter.reset();
}, RATE_LIMIT_WINDOW);

const getClientIp = (c: Context): string =>
    clientIpFrom(c.req.header('x-forwarded-for'), c.req.raw.headers.get('x-real-ip'));

// Rate limit + validation + log dispatch in one linear flow; splitting further would scatter one request.
// fallow-ignore-next-line complexity
export const receiveLogs = async (c: Context) => {
    const logger = getLogger();
    const clientIp = getClientIp(c);

    if (!rateLimiter.isAllowed(clientIp)) {
        logger.warn('Frontend logs rate limit exceeded', { clientIp });

        return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const log = await c.req.json<FrontendLog>();

    if (!log.level || !log.message) {
        logger.warn('Invalid frontend log received', { clientIp, level: log.level, hasMessage: Boolean(log.message) });

        return c.json({ error: 'level and message are required' }, 400);
    }

    if (!['debug', 'info', 'warn', 'error'].includes(log.level)) {
        logger.warn('Invalid log level received', { clientIp, level: log.level });

        return c.json({ error: 'Invalid log level' }, 400);
    }

    try {
        const logContext = {
            ...allowedContext(log.context),
            source: 'frontend',
            clientIp,
            userAgent: log.userAgent || 'unknown',
            url: log.url || 'unknown',
        };

        (logger as unknown as Record<string, (msg: string, ctx: unknown) => void>)[log.level](log.message, logContext);

        return new Response(null, { status: 204 });
    } catch (error) {
        logger.error('Failed to process frontend log', { clientIp, error });

        return c.json({ error: 'Failed to process log' }, 500);
    }
};
