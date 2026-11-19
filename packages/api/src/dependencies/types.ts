import type { Logger, MongoDbConnection, ObjectStoreConnection } from '@imapps/api-utils';
import type {
    DiscoveryRecipe,
    Friendship,
    Label,
    List,
    MealPlanEntry,
    PairingCode,
    PushSubscription,
    Recipe,
    Todo,
} from '@tandra/types';

import type { AccountService, ObjectEraser } from '../domain/AccountService';
import type { AuthorizationService } from '../domain/AuthorizationService';
import type { DailyReminderScheduler } from '../domain/DailyReminderScheduler';
import type { DiscoveryCopyService } from '../domain/DiscoveryCopyService';
import type { DiscoveryModerationService } from '../domain/DiscoveryModeration';
import type { DiscoveryPublication, DiscoveryPublicationRepository } from '../domain/DiscoveryPublicationRepository';
import type { DiscoveryPublishService } from '../domain/DiscoveryPublish';
import type { DiscoveryRecipeRepository } from '../domain/DiscoveryRecipeRepository';
import type { DiscoveryReport, DiscoveryReportRepository } from '../domain/DiscoveryReportRepository';
import type { DiscoveryService } from '../domain/DiscoveryService';
import type { DiscoveryIndex } from '../domain/DiscoveryService/types';
import type { FriendRepository } from '../domain/FriendRepository';
import type { FriendService } from '../domain/FriendService';
import type { IdGenerator } from '../domain/IdGenerator';
import type { ImageService } from '../domain/ImageService';
import type { ImageGenerator, ImageStore } from '../domain/ImageService/types';
import type { ItemCategoryRepository } from '../domain/ItemCategoryRepository';
import type { ItemCategoryService } from '../domain/ItemCategoryService';
import type { LabelRepository } from '../domain/LabelRepository';
import type { LabelService } from '../domain/LabelService';
import type { ListInviteRepository } from '../domain/ListInviteRepository';
import type { ListInviteService } from '../domain/ListInviteService';
import type { ListRealtimeHub } from '../domain/ListRealtimeHub';
import type { ListRepository } from '../domain/ListRepository';
import type { ListService } from '../domain/ListService';
import type { MealPlanRepository } from '../domain/MealPlanRepository';
import type { MealPlanService } from '../domain/MealPlanService';
import type { NotificationService } from '../domain/NotificationService';
import type { PushSubscriptionRepository } from '../domain/PushSubscriptionRepository';
import type { RecipeImageService } from '../domain/RecipeImageService';
import type { RecipeImportService } from '../domain/RecipeImportService';
import type { ImageFetcher, PageFetcher, RecipeParser, RecipeTextExtractor } from '../domain/RecipeImportService/types';
import type { RecipeRepository } from '../domain/RecipeRepository';
import type { RecipeService } from '../domain/RecipeService';
import type { TodoReminderService } from '../domain/TodoReminderService';
import type { TodoRepository } from '../domain/TodoRepository';
import type { TodoService } from '../domain/TodoService';
import type { WikibooksIngestService } from '../domain/WikibooksIngest';
import type { RecipeEstimator, WikibooksSource } from '../domain/WikibooksIngest/types';
import type { WsTicketStore } from '../domain/WsTicketStore';
import type { Auth } from '../infrastructure/BetterAuth';
import type { CachedIngredientSubstituter } from '../infrastructure/CachedIngredientSubstituter';
import type { FalItemTextParser } from '../infrastructure/FalItemTextParser';
import type { FalLlmClient } from '../infrastructure/FalLlmClient';
import type { FalRecipeTagger } from '../infrastructure/FalRecipeTagger';
import type { ItemCategoryDoc } from '../infrastructure/MongoItemCategoryRepository';
import type { WebPushSender } from '../infrastructure/WebPushSender';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Collections = {
    [CollectionNames.List]: List;
    [CollectionNames.Recipe]: Recipe;
    [CollectionNames.Todo]: Todo;
    [CollectionNames.Label]: Label;
    [CollectionNames.PushSubscription]: PushSubscription;
    [CollectionNames.Friendship]: Friendship;
    [CollectionNames.PairingCode]: PairingCode;
    [CollectionNames.DiscoveryRecipe]: DiscoveryRecipe;
    [CollectionNames.DiscoveryPublication]: DiscoveryPublication;
    [CollectionNames.DiscoveryReport]: DiscoveryReport;
    [CollectionNames.ItemCategory]: ItemCategoryDoc;
    [CollectionNames.MealPlan]: MealPlanEntry;
};

export enum DependencyToken {
    Database = 'Database',
    Logger = 'Logger',
    Bucket = 'Bucket',
    IdGenerator = 'IdGenerator',
    ListRepository = 'ListRepository',
    ListService = 'ListService',
    RecipeService = 'RecipeService',
    Auth = 'Auth',
    AuthorizationService = 'AuthorizationService',
    ImageStore = 'ImageStore',
    ImageGenerator = 'ImageGenerator',
    ImageService = 'ImageService',
    RecipeRepository = 'RecipeRepository',
    RecipeHandlers = 'RecipeHandlers',
    RecipeImageGenerator = 'RecipeImageGenerator',
    RecipeImageService = 'RecipeImageService',
    PageFetcher = 'PageFetcher',
    ImageFetcher = 'ImageFetcher',
    FalLlmClient = 'FalLlmClient',
    RecipeTagger = 'RecipeTagger',
    RecipeTextExtractor = 'RecipeTextExtractor',
    RecipeParser = 'RecipeParser',
    IngredientSubstituter = 'IngredientSubstituter',
    MealPlanRepository = 'MealPlanRepository',
    MealPlanService = 'MealPlanService',
    ItemTextParser = 'ItemTextParser',
    ItemCategoryRepository = 'ItemCategoryRepository',
    ItemCategoryService = 'ItemCategoryService',
    RecipeImportService = 'RecipeImportService',
    TodoRepository = 'TodoRepository',
    TodoService = 'TodoService',
    LabelRepository = 'LabelRepository',
    LabelService = 'LabelService',
    PushSubscriptionRepository = 'PushSubscriptionRepository',
    WebPushSender = 'WebPushSender',
    NotificationService = 'NotificationService',
    TodoReminderService = 'TodoReminderService',
    DailyReminderScheduler = 'DailyReminderScheduler',
    FriendRepository = 'FriendRepository',
    FriendService = 'FriendService',
    ListRealtimeHub = 'ListRealtimeHub',
    WsTicketStore = 'WsTicketStore',
    DiscoveryRecipeRepository = 'DiscoveryRecipeRepository',
    DiscoveryIndex = 'DiscoveryIndex',
    DiscoveryService = 'DiscoveryService',
    DiscoveryCopyService = 'DiscoveryCopyService',
    DiscoveryPublicationRepository = 'DiscoveryPublicationRepository',
    DiscoveryReportRepository = 'DiscoveryReportRepository',
    DiscoveryPublishService = 'DiscoveryPublishService',
    DiscoveryModerationService = 'DiscoveryModerationService',
    WikibooksSource = 'WikibooksSource',
    RecipeEstimator = 'RecipeEstimator',
    WikibooksIngestService = 'WikibooksIngestService',
    ListInviteRepository = 'ListInviteRepository',
    ListInviteService = 'ListInviteService',
    ObjectEraser = 'ObjectEraser',
    AccountService = 'AccountService',
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Dependencies = {
    [DependencyToken.Database]: MongoDbConnection<Collections>;
    [DependencyToken.Logger]: Logger;
    [DependencyToken.Bucket]: ObjectStoreConnection;
    [DependencyToken.IdGenerator]: IdGenerator;
    [DependencyToken.ListRepository]: ListRepository;
    [DependencyToken.ListService]: ListService;
    [DependencyToken.RecipeService]: RecipeService;
    [DependencyToken.Auth]: Auth;
    [DependencyToken.AuthorizationService]: AuthorizationService;
    [DependencyToken.ImageStore]: ImageStore;
    [DependencyToken.ImageGenerator]: ImageGenerator;
    [DependencyToken.ImageService]: ImageService;
    [DependencyToken.RecipeRepository]: RecipeRepository;
    [DependencyToken.RecipeHandlers]: typeof import('../interfaces/RecipeHandlers');
    [DependencyToken.RecipeImageGenerator]: ImageGenerator;
    [DependencyToken.RecipeImageService]: RecipeImageService;
    [DependencyToken.PageFetcher]: PageFetcher;
    [DependencyToken.ImageFetcher]: ImageFetcher;
    [DependencyToken.FalLlmClient]: FalLlmClient;
    [DependencyToken.RecipeTagger]: FalRecipeTagger;
    [DependencyToken.RecipeTextExtractor]: RecipeTextExtractor;
    [DependencyToken.RecipeParser]: RecipeParser;
    [DependencyToken.IngredientSubstituter]: CachedIngredientSubstituter;
    [DependencyToken.MealPlanRepository]: MealPlanRepository;
    [DependencyToken.MealPlanService]: MealPlanService;
    [DependencyToken.ItemTextParser]: FalItemTextParser;
    [DependencyToken.ItemCategoryRepository]: ItemCategoryRepository;
    [DependencyToken.ItemCategoryService]: ItemCategoryService;
    [DependencyToken.RecipeImportService]: RecipeImportService;
    [DependencyToken.TodoRepository]: TodoRepository;
    [DependencyToken.TodoService]: TodoService;
    [DependencyToken.LabelRepository]: LabelRepository;
    [DependencyToken.LabelService]: LabelService;
    [DependencyToken.PushSubscriptionRepository]: PushSubscriptionRepository;
    [DependencyToken.WebPushSender]: WebPushSender;
    [DependencyToken.NotificationService]: NotificationService;
    [DependencyToken.TodoReminderService]: TodoReminderService;
    [DependencyToken.DailyReminderScheduler]: DailyReminderScheduler;
    [DependencyToken.FriendRepository]: FriendRepository;
    [DependencyToken.FriendService]: FriendService;
    [DependencyToken.ListRealtimeHub]: ListRealtimeHub;
    [DependencyToken.WsTicketStore]: WsTicketStore;
    [DependencyToken.DiscoveryRecipeRepository]: DiscoveryRecipeRepository;
    [DependencyToken.DiscoveryIndex]: DiscoveryIndex;
    [DependencyToken.DiscoveryService]: DiscoveryService;
    [DependencyToken.DiscoveryCopyService]: DiscoveryCopyService;
    [DependencyToken.DiscoveryPublicationRepository]: DiscoveryPublicationRepository;
    [DependencyToken.DiscoveryReportRepository]: DiscoveryReportRepository;
    [DependencyToken.DiscoveryPublishService]: DiscoveryPublishService;
    [DependencyToken.DiscoveryModerationService]: DiscoveryModerationService;
    [DependencyToken.WikibooksSource]: WikibooksSource;
    [DependencyToken.RecipeEstimator]: RecipeEstimator;
    [DependencyToken.WikibooksIngestService]: WikibooksIngestService;
    [DependencyToken.ListInviteRepository]: ListInviteRepository;
    [DependencyToken.ListInviteService]: ListInviteService;
    [DependencyToken.ObjectEraser]: ObjectEraser;
    [DependencyToken.AccountService]: AccountService;
};

export enum CollectionNames {
    List = 'list',
    Recipe = 'recipe',
    Todo = 'todo',
    Label = 'label',
    PushSubscription = 'pushSubscription',
    Friendship = 'friendships',
    PairingCode = 'pairingCodes',
    DiscoveryRecipe = 'discoveryRecipes',
    DiscoveryPublication = 'discoveryPublications',
    DiscoveryReport = 'discoveryReports',
    ItemCategory = 'itemCategories',
    MealPlan = 'mealPlan',
    ListInvite = 'listInvites',
}
