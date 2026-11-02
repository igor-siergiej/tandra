import type { Logger } from '@imapps/api-utils';
import type { Context } from 'hono';
import { z } from 'zod';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import { clientIpFrom } from '../../infrastructure/clientIp';
import { IpRateLimiter } from '../../infrastructure/rateLimit';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

// Every field is decoded leniently: the handler answers a bad level or message with its own 400s.
const frontendLogSchema = z
    .object({
        level: z.string().optional().catch(undefined),
        message: z.string().optional().catch(undefined),
        context: z.record(z.string(), z.json()).optional().catch(undefined),
        userAgent: z.string().optional().catch(undefined),
        url: z.string().optional().catch(undefined),
    })
    .catch({});

type LogMethod = (message: string, ...meta: Array<unknown>) => void;

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

    const body = await c.req.json();
    const log = frontendLogSchema.parse(body);

    if (!log.level || !log.message) {
        logger.warn('Invalid frontend log received', { clientIp, receivedData: body });

        return c.json({ error: 'level and message are required' }, 400);
    }

    const level = z.enum(LOG_LEVELS).safeParse(log.level);

    if (!level.success) {
        logger.warn('Invalid log level received', { clientIp, level: log.level });

        return c.json({ error: 'Invalid log level' }, 400);
    }

    try {
        const logContext = {
            source: 'frontend',
            clientIp,
            userAgent: log.userAgent || 'unknown',
            url: log.url || 'unknown',
            ...log.context,
        };

        // SAFETY: the shared Logger only declares info/warn/error; a Logger without `debug` makes the call below throw, which the catch reports as a 500, as before.
        const sink = logger as Logger & Record<'debug', LogMethod>;

        sink[level.data](log.message, logContext);

        return new Response(null, { status: 204 });
    } catch (error) {
        logger.error('Failed to process frontend log', { clientIp, error, log });

        return c.json({ error: 'Failed to process log' }, 500);
    }
};
