import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { Logger, MongoDbConnection, ObjectStoreConnection } from '@imapps/api-utils';
import { Client } from '@opensearch-project/opensearch';
import { MongoClient } from 'mongodb';

import { config } from '../config';
import { allowedOrigins } from '../config/cors';
import { AuthorizationService } from '../domain/AuthorizationService';
import { DailyReminderScheduler } from '../domain/DailyReminderScheduler';
import { DiscoveryCopyService } from '../domain/DiscoveryCopyService';
import { DiscoveryModerationService } from '../domain/DiscoveryModeration';
import { DiscoveryPublishService } from '../domain/DiscoveryPublish';
import { DiscoveryService } from '../domain/DiscoveryService';
import { FriendService } from '../domain/FriendService';
import { ImageService } from '../domain/ImageService';
import { ItemCategoryService } from '../domain/ItemCategoryService';
import { LabelService } from '../domain/LabelService';
import { ListInviteService } from '../domain/ListInviteService';
import { ListRealtimeHub } from '../domain/ListRealtimeHub';
import { ListService } from '../domain/ListService';
import { MealPlanService } from '../domain/MealPlanService';
import { NotificationService } from '../domain/NotificationService';
import { RecipeImageService } from '../domain/RecipeImageService';
import { RecipeImportService } from '../domain/RecipeImportService';
import { RecipeService } from '../domain/RecipeService';
import { RuleIngredientStructurer } from '../domain/RuleIngredientStructurer';
import { TodoReminderService } from '../domain/TodoReminderService';
import { TodoService } from '../domain/TodoService';
import { WikibooksIngestService } from '../domain/WikibooksIngest';
import { WikibooksCoverService } from '../domain/WikibooksIngest/cover';
import { WsTicketStore } from '../domain/WsTicketStore';
import { createAuth } from '../infrastructure/BetterAuth';
import { BucketStore } from '../infrastructure/BucketStore';
import { CachedIngredientSubstituter } from '../infrastructure/CachedIngredientSubstituter';
import { FalImageGenerator } from '../infrastructure/FalImageGenerator';
import { FalIngredientSubstituter } from '../infrastructure/FalIngredientSubstituter';
import { FalItemCategoriser } from '../infrastructure/FalItemCategoriser';
import { FalItemTextParser } from '../infrastructure/FalItemTextParser';
import { FalLlmClient } from '../infrastructure/FalLlmClient';
import { FalRecipeEstimator } from '../infrastructure/FalRecipeEstimator';
import { FalRecipeExtractor } from '../infrastructure/FalRecipeExtractor';
import { FalRecipeParser } from '../infrastructure/FalRecipeParser';
import { FalRecipeTagger } from '../infrastructure/FalRecipeTagger';
import { HttpImageFetcher } from '../infrastructure/HttpImageFetcher';
import { HttpPageFetcher } from '../infrastructure/HttpPageFetcher';
import { MediaWikiCookbookSource } from '../infrastructure/MediaWikiCookbookSource';
import { MongoDiscoveryPublicationRepository } from '../infrastructure/MongoDiscoveryPublicationRepository';
import { MongoDiscoveryRecipeRepository } from '../infrastructure/MongoDiscoveryRecipeRepository';
import { MongoDiscoveryReportRepository } from '../infrastructure/MongoDiscoveryReportRepository';
import { MongoFriendRepository } from '../infrastructure/MongoFriendRepository';
import { MongoItemCategoryRepository } from '../infrastructure/MongoItemCategoryRepository';
import { MongoLabelRepository } from '../infrastructure/MongoLabelRepository';
import { MongoListInviteRepository } from '../infrastructure/MongoListInviteRepository';
import { MongoListRepository } from '../infrastructure/MongoListRepository';
import { MongoMealPlanRepository } from '../infrastructure/MongoMealPlanRepository';
import { MongoPushSubscriptionRepository } from '../infrastructure/MongoPushSubscriptionRepository';
import { MongoRecipeRepository } from '../infrastructure/MongoRecipeRepository';
import { MongoTodoRepository } from '../infrastructure/MongoTodoRepository';
import { type OpenSearchApi, OpenSearchDiscoveryIndex } from '../infrastructure/OpenSearchDiscoveryIndex';
import { UuidGenerator } from '../infrastructure/UuidGenerator';
import { WebPushSender } from '../infrastructure/WebPushSender';
import * as RecipeHandlers from '../interfaces/RecipeHandlers';
import { dependencyContainer } from './container';
import { type Dependencies, DependencyToken } from './types';

export { dependencyContainer };

// The container instantiates `new ctor()`. A function declaration that returns an object is a valid constructor for
// that (the returned object wins), so factories need no class that returns from its constructor. It must stay a
// declaration: an arrow function cannot be constructed.
const register = <K extends keyof Dependencies & string>(token: K, make: () => Dependencies[K]) => {
    function Factory() {
        return make();
    }
    dependencyContainer.registerSingleton(
        token,
        Factory as unknown as Parameters<typeof dependencyContainer.registerSingleton<K>>[1]
    );
};

const googleConfig = (): { clientId: string; clientSecret: string } | undefined => {
    const clientId = config.get('googleClientId');
    const clientSecret = config.get('googleClientSecret');
    return clientId && clientSecret ? { clientId, clientSecret } : undefined;
};

const buildBetterAuth = () => {
    const db = new MongoClient(config.get('connectionUri')).db(config.get('databaseName'));
    return createAuth({
        database: mongodbAdapter(db, { transaction: false }),
        secret: config.get('betterAuthSecret'),
        baseURL: config.get('betterAuthUrl'),
        trustedOrigins: allowedOrigins,
        google: googleConfig(),
        logger: dependencyContainer.resolve(DependencyToken.Logger),
    });
};

export const registerDepdendencies = () => {
    // Core infrastructure services
    dependencyContainer.registerSingleton(DependencyToken.Database, MongoDbConnection);
    dependencyContainer.registerSingleton(DependencyToken.Logger, Logger);
    dependencyContainer.registerSingleton(DependencyToken.Bucket, ObjectStoreConnection);
    dependencyContainer.registerSingleton(DependencyToken.IdGenerator, UuidGenerator);
    dependencyContainer.registerSingleton(DependencyToken.AuthorizationService, AuthorizationService);
    dependencyContainer.registerSingleton(DependencyToken.ListRealtimeHub, ListRealtimeHub);
    dependencyContainer.registerSingleton(DependencyToken.WsTicketStore, WsTicketStore);

    // Better Auth — owns the embedded username/password + Google flow mounted at /api/auth/*.
    // The api-utils Mongo connection hides its `Db`, so we open a fresh MongoClient against the
    // same connectionUri/databaseName (the driver connects lazily). `transaction: false` because
    // the local dev mongo is a standalone without a replica set; prod is a single node today.
    register(DependencyToken.Auth, () => buildBetterAuth());
    // Domain services using factory classes
    register(
        DependencyToken.ListRepository,
        () => new MongoListRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.PushSubscriptionRepository,
        () => new MongoPushSubscriptionRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.WebPushSender,
        () =>
            new WebPushSender(
                config.get('vapidPublicKey'),
                config.get('vapidPrivateKey'),
                config.get('vapidSubject'),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(
        DependencyToken.NotificationService,
        () =>
            new NotificationService(
                dependencyContainer.resolve(DependencyToken.PushSubscriptionRepository),
                dependencyContainer.resolve(DependencyToken.WebPushSender),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(
        DependencyToken.ListService,
        () =>
            new ListService(
                dependencyContainer.resolve(DependencyToken.ListRepository),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.Logger),
                dependencyContainer.resolve(DependencyToken.AuthorizationService),
                dependencyContainer.resolve(DependencyToken.NotificationService),
                dependencyContainer.resolve(DependencyToken.FriendService),
                dependencyContainer.resolve(DependencyToken.ItemCategoryService),
                (listId) => dependencyContainer.resolve(DependencyToken.ListRealtimeHub).notifyChanged(listId)
            )
    );

    register(
        DependencyToken.ItemTextParser,
        () => new FalItemTextParser(dependencyContainer.resolve(DependencyToken.FalLlmClient))
    );

    register(
        DependencyToken.ItemCategoryRepository,
        () => new MongoItemCategoryRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.ItemCategoryService,
        () =>
            new ItemCategoryService(
                dependencyContainer.resolve(DependencyToken.ItemCategoryRepository),
                new FalItemCategoriser(dependencyContainer.resolve(DependencyToken.FalLlmClient)),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    // Recipe services
    register(
        DependencyToken.RecipeRepository,
        () => new MongoRecipeRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.RecipeService,
        () =>
            new RecipeService(
                dependencyContainer.resolve(DependencyToken.RecipeRepository),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.Logger),
                dependencyContainer.resolve(DependencyToken.AuthorizationService),
                dependencyContainer.resolve(DependencyToken.RecipeImageService),
                dependencyContainer.resolve(DependencyToken.FriendService),
                dependencyContainer.resolve(DependencyToken.RecipeTagger),
                dependencyContainer.resolve(DependencyToken.IngredientSubstituter)
            )
    );

    // Todo services
    register(
        DependencyToken.TodoRepository,
        () => new MongoTodoRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.MealPlanRepository,
        () => new MongoMealPlanRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.MealPlanService,
        () =>
            new MealPlanService(
                dependencyContainer.resolve(DependencyToken.MealPlanRepository),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.RecipeService),
                dependencyContainer.resolve(DependencyToken.Logger),
                dependencyContainer.resolve(DependencyToken.FriendService)
            )
    );

    register(
        DependencyToken.TodoService,
        () =>
            new TodoService(
                dependencyContainer.resolve(DependencyToken.TodoRepository),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.Logger),
                dependencyContainer.resolve(DependencyToken.FriendService),
                dependencyContainer.resolve(DependencyToken.NotificationService)
            )
    );

    register(
        DependencyToken.TodoReminderService,
        () =>
            new TodoReminderService(
                dependencyContainer.resolve(DependencyToken.TodoRepository),
                dependencyContainer.resolve(DependencyToken.PushSubscriptionRepository),
                dependencyContainer.resolve(DependencyToken.WebPushSender),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(
        DependencyToken.DailyReminderScheduler,
        () =>
            new DailyReminderScheduler(dependencyContainer.resolve(DependencyToken.TodoReminderService), {
                logger: dependencyContainer.resolve(DependencyToken.Logger),
            })
    );

    // Friend services
    register(
        DependencyToken.FriendRepository,
        () => new MongoFriendRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.FriendService,
        () =>
            new FriendService(
                dependencyContainer.resolve(DependencyToken.FriendRepository),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.Logger),
                dependencyContainer.resolve(DependencyToken.ListRepository),
                dependencyContainer.resolve(DependencyToken.RecipeRepository),
                dependencyContainer.resolve(DependencyToken.TodoRepository),
                dependencyContainer.resolve(DependencyToken.MealPlanRepository)
            )
    );

    // Label services
    register(
        DependencyToken.LabelRepository,
        () => new MongoLabelRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.LabelService,
        () =>
            new LabelService(
                dependencyContainer.resolve(DependencyToken.LabelRepository),
                dependencyContainer.resolve(DependencyToken.TodoRepository),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(DependencyToken.RecipeHandlers, () => RecipeHandlers);

    // Image services
    register(DependencyToken.ImageStore, () => new BucketStore(dependencyContainer.resolve(DependencyToken.Bucket)));

    register(
        DependencyToken.ImageGenerator,
        () =>
            new FalImageGenerator(config.get('falKey') || '', {
                model: config.get('falModel') || 'fal-ai/flux/schnell',
                imageSize: 'square',
                outputFormat: 'png',
                outputSize: 256,
            })
    );

    register(
        DependencyToken.RecipeImageGenerator,
        () =>
            new FalImageGenerator(config.get('falKey') || '', {
                model: config.get('falRecipeModel') || 'fal-ai/flux/schnell',
                imageSize: 'square_hd',
                outputFormat: 'jpeg',
                outputSize: 512,
            })
    );

    register(
        DependencyToken.ImageService,
        () =>
            new ImageService(
                dependencyContainer.resolve(DependencyToken.ImageStore),
                dependencyContainer.resolve(DependencyToken.ImageGenerator),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(
        DependencyToken.RecipeImageService,
        () =>
            new RecipeImageService(
                dependencyContainer.resolve(DependencyToken.ImageStore),
                dependencyContainer.resolve(DependencyToken.RecipeImageGenerator),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    // Recipe import (scrape a recipe URL into an editable draft)
    register(DependencyToken.PageFetcher, () => new HttpPageFetcher());

    register(DependencyToken.ImageFetcher, () => new HttpImageFetcher());

    register(DependencyToken.FalLlmClient, () => {
        // Reuses FAL_KEY unless a dedicated import key is set.
        return new FalLlmClient(
            config.get('recipeImportLlmApiKey') || config.get('falKey') || '',
            dependencyContainer.resolve(DependencyToken.Logger),
            { model: config.get('recipeImportLlmModel') || undefined }
        );
    });

    register(
        DependencyToken.RecipeTextExtractor,
        () => new FalRecipeExtractor(dependencyContainer.resolve(DependencyToken.FalLlmClient))
    );

    register(
        DependencyToken.RecipeTagger,
        () => new FalRecipeTagger(dependencyContainer.resolve(DependencyToken.FalLlmClient))
    );

    register(
        DependencyToken.IngredientSubstituter,
        () =>
            new CachedIngredientSubstituter(
                new FalIngredientSubstituter(dependencyContainer.resolve(DependencyToken.FalLlmClient))
            )
    );

    register(
        DependencyToken.RecipeParser,
        () => new FalRecipeParser(dependencyContainer.resolve(DependencyToken.FalLlmClient))
    );

    register(DependencyToken.RecipeImportService, () => {
        // Tier 3 is opt-in: only inject the LLM extractor when explicitly enabled.
        const llmExtractor = config.get('recipeImportLlmEnabled')
            ? dependencyContainer.resolve(DependencyToken.RecipeTextExtractor)
            : undefined;
        // LLM-first is opt-in: injecting the parser makes it win over the three tiers.
        const llmParser = config.get('recipeImportLlmFirst')
            ? dependencyContainer.resolve(DependencyToken.RecipeParser)
            : undefined;
        return new RecipeImportService(
            dependencyContainer.resolve(DependencyToken.PageFetcher),
            dependencyContainer.resolve(DependencyToken.IdGenerator),
            new RuleIngredientStructurer(),
            dependencyContainer.resolve(DependencyToken.Logger),
            llmExtractor,
            llmParser,
            dependencyContainer.resolve(DependencyToken.ImageFetcher)
        );
    });

    // Recipe discovery: Mongo is the library's system of record, OpenSearch a derived index over it.
    register(
        DependencyToken.DiscoveryRecipeRepository,
        () => new MongoDiscoveryRecipeRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    // List invites: random opaque token in the document id; lifetime enforced by the service.
    register(
        DependencyToken.ListInviteRepository,
        () => new MongoListInviteRepository(dependencyContainer.resolve(DependencyToken.Database))
    );
    register(
        DependencyToken.ListInviteService,
        () =>
            new ListInviteService(
                {
                    invites: dependencyContainer.resolve(DependencyToken.ListInviteRepository),
                    lists: dependencyContainer.resolve(DependencyToken.ListService),
                    friends: dependencyContainer.resolve(DependencyToken.FriendService),
                },
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(DependencyToken.DiscoveryIndex, () => {
        const url = config.get('opensearchUrl');
        // Fail fast rather than queue requests behind a dead engine: discovery is optional, the rest of the API is not.
        const client = url ? new Client({ node: url, requestTimeout: 5000, maxRetries: 1 }) : null;
        return new OpenSearchDiscoveryIndex(
            client as unknown as OpenSearchApi | null,
            dependencyContainer.resolve(DependencyToken.Logger),
            config.get('opensearchIndex') || undefined
        );
    });

    register(
        DependencyToken.DiscoveryService,
        () =>
            new DiscoveryService(
                dependencyContainer.resolve(DependencyToken.DiscoveryRecipeRepository),
                dependencyContainer.resolve(DependencyToken.DiscoveryIndex),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(
        DependencyToken.DiscoveryCopyService,
        () =>
            new DiscoveryCopyService(
                dependencyContainer.resolve(DependencyToken.DiscoveryService),
                dependencyContainer.resolve(DependencyToken.RecipeService),
                dependencyContainer.resolve(DependencyToken.ImageStore),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    // User publishing and moderation of the library.
    register(
        DependencyToken.DiscoveryPublicationRepository,
        () => new MongoDiscoveryPublicationRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.DiscoveryReportRepository,
        () => new MongoDiscoveryReportRepository(dependencyContainer.resolve(DependencyToken.Database))
    );

    register(
        DependencyToken.DiscoveryPublishService,
        () =>
            new DiscoveryPublishService(
                dependencyContainer.resolve(DependencyToken.DiscoveryService),
                dependencyContainer.resolve(DependencyToken.DiscoveryPublicationRepository),
                dependencyContainer.resolve(DependencyToken.RecipeService),
                dependencyContainer.resolve(DependencyToken.ImageStore),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );

    register(DependencyToken.DiscoveryModerationService, () => {
        const admins = (config.get('discoveryAdminUserIds') ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        return new DiscoveryModerationService(
            dependencyContainer.resolve(DependencyToken.DiscoveryService),
            dependencyContainer.resolve(DependencyToken.DiscoveryReportRepository),
            dependencyContainer.resolve(DependencyToken.DiscoveryPublicationRepository),
            dependencyContainer.resolve(DependencyToken.IdGenerator),
            new Set(admins),
            dependencyContainer.resolve(DependencyToken.Logger)
        );
    });

    // Wikibooks Cookbook ingest: fills the library from the wiki and keeps it in step with it.
    register(
        DependencyToken.WikibooksSource,
        () =>
            new MediaWikiCookbookSource(dependencyContainer.resolve(DependencyToken.Logger), {
                userAgent: config.get('wikibooksUserAgent') || undefined,
            })
    );

    register(
        DependencyToken.RecipeEstimator,
        () => new FalRecipeEstimator(dependencyContainer.resolve(DependencyToken.FalLlmClient))
    );

    register(
        DependencyToken.WikibooksIngestService,
        () =>
            new WikibooksIngestService(
                dependencyContainer.resolve(DependencyToken.WikibooksSource),
                dependencyContainer.resolve(DependencyToken.DiscoveryService),
                new RuleIngredientStructurer(),
                dependencyContainer.resolve(DependencyToken.RecipeTagger),
                dependencyContainer.resolve(DependencyToken.RecipeEstimator),
                dependencyContainer.resolve(DependencyToken.IdGenerator),
                new WikibooksCoverService(
                    dependencyContainer.resolve(DependencyToken.WikibooksSource),
                    dependencyContainer.resolve(DependencyToken.ImageStore),
                    dependencyContainer.resolve(DependencyToken.Logger)
                ),
                dependencyContainer.resolve(DependencyToken.Logger)
            )
    );
};
