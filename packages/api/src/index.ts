import 'dotenv/config';

import { createApp } from '@imapps/api-utils/hono';
import { config } from './config';
import { allowedOrigins } from './config/cors';
import { dependencyContainer, registerDepdendencies } from './dependencies';
import { DependencyToken } from './dependencies/types';
import { websocket } from './infrastructure/bunWebSocket';
import {
    httpRequestDurationSeconds,
    httpRequestsTotal,
    metricsRegister,
    startDefaultMetrics,
} from './infrastructure/metrics';
import { csrfForFormPosts } from './middleware/csrf';
import { backfillWikibooksSlugs } from './migrations/wikibooksSlugs';
import { createRoutes } from './routes';

const port = config.get('port');

const mountBetterAuth = (app: ReturnType<typeof createApp>) => {
    const auth = dependencyContainer.resolve(DependencyToken.Auth);
    // The public origin Better Auth is configured for is the app's own origin (self-hosts included), so
    // multipart uploads from it must pass the form-post origin check too.
    const publicOrigin = new URL(config.get('betterAuthUrl')).origin;
    app.use('/api/*', csrfForFormPosts([...allowedOrigins, publicOrigin]));
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
};

export const onStartup = async () => {
    try {
        startDefaultMetrics();

        registerDepdendencies();

        const logger = dependencyContainer.resolve(DependencyToken.Logger);
        const database = dependencyContainer.resolve(DependencyToken.Database);
        const bucket = dependencyContainer.resolve(DependencyToken.Bucket);

        if (!database) {
            throw new Error('Database dependency not found');
        }

        const app = createApp({ logger, allowedOrigins });

        // Metrics endpoint — exposed before auth
        app.get('/api/metrics', async (c) => {
            c.header('Content-Type', metricsRegister.contentType);
            return c.body(await metricsRegister.metrics());
        });

        // Prometheus instrumentation middleware
        app.use(async (c, next) => {
            const endTimer = httpRequestDurationSeconds.startTimer();
            await next();
            const route = c.req.routePath ?? 'unmatched';
            const labels = { method: c.req.method, route, status: String(c.res.status) };
            endTimer(labels);
            httpRequestsTotal.inc(labels);
        });

        // Better Auth session cookie. Mounted on GET + POST so `/api/auth/get-session` (HEAD/GET)
        // and the form POSTs land on the same handler. `c.req.raw` is passed through — Hono does
        // not consume the body before reaching this point, so a full sign-up round-trip works.
        mountBetterAuth(app);

        logger.info('Starting API server - connecting to database and object store');
        await database.connect({
            connectionUri: config.get('connectionUri'),
            databaseName: config.get('databaseName'),
        });
        logger.info('Connected to database');

        await dependencyContainer.resolve(DependencyToken.ListRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.RecipeRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.ItemCategoryRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.MealPlanRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.TodoRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.LabelRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.FriendRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.PushSubscriptionRepository).ensureIndexes();
        const discoveryRecipes = dependencyContainer.resolve(DependencyToken.DiscoveryRecipeRepository);
        await discoveryRecipes.ensureIndexes();
        // Library recipes stored before ingest set slugs; a no-op once done, and never fatal.
        await backfillWikibooksSlugs(discoveryRecipes, logger);
        await dependencyContainer.resolve(DependencyToken.DiscoveryPublicationRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.DiscoveryReportRepository).ensureIndexes();
        await dependencyContainer.resolve(DependencyToken.ListInviteRepository).ensureIndexes();
        // Discovery is optional: a search engine that is down at boot must not stop the rest of the API. The index
        // is created lazily on the first request that finds it reachable.
        dependencyContainer
            .resolve(DependencyToken.DiscoveryService)
            .ensureIndex()
            .catch((error: unknown) => logger.warn('Discovery index not ready at startup', { error: String(error) }));

        await bucket.connect?.({
            endpoint: config.get('bucketEndpoint'),
            accessKey: config.get('bucketAccessKey'),
            secretKey: config.get('bucketSecretKey'),
            bucketName: config.get('bucketName'),
        });
        logger.info('Connected to object store');

        app.route('/', createRoutes());

        Bun.serve({
            port,
            fetch: app.fetch,
            websocket,
        });

        logger.info(`Tandra API server running on port ${port}`);

        dependencyContainer.resolve(DependencyToken.DailyReminderScheduler).start();
        logger.info('Daily todo reminder scheduler started');
    } catch (error) {
        const logger = dependencyContainer.resolve(DependencyToken.Logger);
        logger.error('Encountered an error on start up', error);
        process.exit(1);
    }
};

onStartup();
