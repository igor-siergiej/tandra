export enum ListType {
    SHOPPING = 'shopping',
}

export const ITEM_CATEGORIES = [
    'produce',
    'dairy',
    'bakery',
    'meat-fish',
    'frozen',
    'pantry',
    'drinks',
    'household',
    'other',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface Item {
    id: string;
    name: string;
    isSelected: boolean;
    dateAdded: Date;
    quantity?: number;
    unit?: string;
    dueDate?: Date;
    /** Aisle the item belongs to. Absent until classified; a user-set value is never overwritten by the classifier. */
    category?: ItemCategory;
}

export interface List {
    id: string;
    title: string;
    dateAdded: Date;
    items: Array<Item>;
    users: Array<User>;
    listType: ListType;
    ownerId?: string;
    /** Write counter the API uses for optimistic concurrency; absent until the list is first written to. */
    revision?: number;
}

export interface ListResponse {
    id: string;
    title: string;
    dateAdded: Date;
    items: Array<Item>;
    users: Array<User>;
    listType: ListType;
    ownerId?: string;
}

export interface User {
    id: string;
    username: string;
}

export interface Friendship {
    id: string;
    /** Canonical sorted pair key — userIds[0] < userIds[1] lexicographically. */
    userIds: [string, string];
    /** {id, username} snapshots for display without a user lookup. */
    users: [User, User];
    createdAt: Date;
}

export interface PairingCode {
    code: string;
    creatorId: string;
    creatorUsername: string;
    /** createdAt + 15 minutes. */
    expiresAt: Date;
    /** Set when redeemed — enforces single use. */
    usedAt?: Date;
}

export interface Ingredient {
    id: string;
    name: string;
    quantity?: number;
    unit?: string;
}

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export interface Recipe {
    id: string;
    title: string;
    ingredients: Ingredient[];
    coverImageKey?: string;
    /** The AI-generated image key, generated once and kept so the cover can revert to it for free. */
    aiImageKey?: string;
    users: User[];
    ownerId?: string;
    dateAdded: Date;
    link?: string;
    instructions?: string[];
    tags?: string[];
    /** Minutes, not a raw ISO-8601 duration string — see applyImportedDraft.ts for import parsing. */
    prepTime?: number;
    /** Minutes, not a raw ISO-8601 duration string — see applyImportedDraft.ts for import parsing. */
    cookTime?: number;
    servings?: number;
    difficulty?: RecipeDifficulty;
    /** Licence attribution carried over from a discovery-library recipe this one was copied from; must stay displayed. */
    attribution?: string;
}

export interface RecipeResponse {
    id: string;
    title: string;
    ingredients: Ingredient[];
    coverImageKey?: string;
    aiImageKey?: string;
    users: Array<{ username: string }>;
    ownerId?: string;
    dateAdded: Date;
    link?: string;
    instructions?: string[];
    tags?: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: RecipeDifficulty;
    attribution?: string;
}

export interface RecipeImportResult {
    title: string;
    ingredients: Ingredient[];
    instructions: string[];
    link: string;
    /** Absolute cover image URL scraped from the page, if any. */
    image?: string;
    prepTime?: string;
    cookTime?: string;
    recipeYield?: string;
}

export type DiscoverySource = 'wikibooks' | 'user';

export type DiscoveryEstimatedField = 'prepTime' | 'cookTime' | 'servings' | 'difficulty';

/** A recipe in the shared discovery library (Mongo `discoveryRecipes`). Never a view onto personal recipes. */
export interface DiscoveryRecipe {
    id: string;
    title: string;
    ingredients: Ingredient[];
    instructions: string[];
    tags: string[];
    /** Minutes. */
    prepTime?: number;
    /** Minutes. */
    cookTime?: number;
    servings?: number;
    difficulty?: RecipeDifficulty;
    coverImageKey?: string;
    source: DiscoverySource;
    sourceUrl: string;
    /** SPDX-style licence id, e.g. `CC-BY-SA-4.0`. */
    licence: string;
    /** Attribution text that must be displayed with the recipe. */
    attribution: string;
    /** Display name; user-published recipes only. */
    publishedBy?: string;
    /** Fields filled in by the extractor rather than read from the source. */
    estimated?: DiscoveryEstimatedField[];
    /** Revision of the source page this copy was built from; lets a refresh skip unchanged pages. Ingested recipes only. */
    sourceRevision?: number;
    /** Revision of the source page whose cover picture has been looked at (found, refused or absent). Ingested recipes only. */
    imageRevision?: number;
    /** Credit for the cover picture (author, licence, where it comes from): must be shown wherever the cover is. */
    coverImageAttribution?: string;
    /** The cover picture's own file page, for the credit to link to. */
    coverImageSourceUrl?: string;
    /**
     * Stable URL slug for the public, unauthenticated discover API. A
     * Wikibooks recipe's slug is its id (`wikibooks-<pageId>`, set by ingest
     * and backfilled at API start); a user-published recipe gets a unique one
     * from its title. Sparse: a recipe without a slug is still served by id
     * from the authenticated /api/discover routes.
     */
    slug?: string;
    createdAt: Date;
    updatedAt: Date;
}

/** What a search hit carries: enough for a result card; the full recipe comes from `GET /api/discover/recipes/:id`. */
export interface DiscoveryRecipeSummary {
    id: string;
    title: string;
    tags: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: RecipeDifficulty;
    coverImageKey?: string;
    source: DiscoverySource;
    estimated?: DiscoveryEstimatedField[];
}

/** Page returned by the unauthenticated public discover list endpoint. */
export interface PublicDiscoveryRecipePage {
    items: PublicDiscoveryRecipeSummary[];
    /** Opaque cursor: pass back to the next request. Absent on the last page. */
    nextCursor?: string;
}

/** Public card shape; never carries user ids, moderation state, or unpublished-recipe fields. */
export interface PublicDiscoveryRecipeSummary {
    id: string;
    slug?: string;
    title: string;
    tags: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: RecipeDifficulty;
    coverImageKey?: string;
    source: DiscoverySource;
    sourceUrl: string;
    licence: string;
    attribution: string;
    /** Author's display name; user-published recipes only, and only when the author opted in. */
    publishedBy?: string;
}

/** Public, read-only projection of a discovery recipe. Same as the full shape minus private fields. */
export interface PublicDiscoveryRecipe extends PublicDiscoveryRecipeSummary {
    ingredients: Ingredient[];
    instructions: string[];
    coverImageAttribution?: string;
    coverImageSourceUrl?: string;
}

/** What a user sends to publish one of their recipes. The licence is only accepted explicitly. */
export interface DiscoveryPublishRequest {
    agreeToLicence: boolean;
    /** Opt in to showing the author's username on the public recipe. Off by default. */
    showName?: boolean;
}

/** One of the caller's own publications: how the app knows a personal recipe is public. */
export interface PublishedRecipeRef {
    recipeId: string;
    libraryId: string;
    publishedAt: Date;
}

/** What an admin sees per reported library recipe. Reporters are never named. */
export interface DiscoveryReportSummary {
    recipeId: string;
    title: string;
    source: DiscoverySource;
    reports: number;
    reasons: string[];
    lastReportedAt: Date;
}

export interface DiscoveryFacetBucket {
    key: string;
    count: number;
}

export interface DiscoveryTimeBucket extends DiscoveryFacetBucket {
    /** Inclusive lower bound of total (prep + cook) minutes. */
    from?: number;
    /** Exclusive upper bound of total (prep + cook) minutes. */
    to?: number;
}

export interface DiscoveryFacets {
    tags: DiscoveryFacetBucket[];
    difficulty: DiscoveryFacetBucket[];
    source: DiscoveryFacetBucket[];
    ingredients: DiscoveryFacetBucket[];
    time: DiscoveryTimeBucket[];
}

export interface DiscoverySearchQuery {
    /** Free text; empty/absent browses the whole library. */
    q?: string;
    /** Recipe must carry every one of these tags. */
    tags?: string[];
    /** Recipe must contain every one of these ingredients (stemmed, synonym-aware). */
    ingredients?: string[];
    /** Recipe difficulty is any of these. */
    difficulty?: RecipeDifficulty[];
    /** Recipe source is any of these. */
    source?: DiscoverySource[];
    /** Total (prep + cook) minutes bounds, inclusive. Recipes without any time never match a time bound. */
    minTime?: number;
    maxTime?: number;
    /** 1-based. */
    page?: number;
    pageSize?: number;
}

export interface DiscoverySearchResult {
    hits: DiscoveryRecipeSummary[];
    total: number;
    page: number;
    pageSize: number;
    facets: DiscoveryFacets;
}

export interface Recurrence {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    /** Recurrence end, as a timezone-agnostic YYYY-MM-DD day. */
    until?: string;
}

export interface Todo {
    id: string;
    ownerId: string;
    title: string;
    done: boolean;
    dateAdded: Date;
    /** Scheduled day, as a timezone-agnostic YYYY-MM-DD string. */
    dueDate?: string;
    time?: string;
    labelId?: string;
    recurrence?: Recurrence;
    completedDates?: string[];
    /** Friends this todo is shared with (excludes the owner, who is implicit via ownerId). */
    users?: Array<User>;
}

export interface TodoResponse extends Todo {}

/** A recipe planned for a day, with the number of portions to cook. */
export interface MealPlanEntry {
    id: string;
    ownerId: string;
    /** Planned day, as a timezone-agnostic YYYY-MM-DD string. */
    date: string;
    recipeId: string;
    servings: number;
    dateAdded: Date;
    /** Friends this plan entry is shared with (excludes the owner, who is implicit via ownerId). */
    users?: Array<User>;
}

export interface Label {
    id: string;
    ownerId: string;
    name: string;
    color: string;
}

export interface LabelResponse extends Label {}

export interface PushSubscription {
    /** Push service endpoint URL — unique per browser/device. Used as the document id. */
    endpoint: string;
    userId: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    dateAdded: Date;
}

/**
 * A shareable invite link for a single list. Created by the list owner,
 * opened by anyone with the link, redeemed by an authenticated user to
 * join the list and become friends with the owner.
 */
export interface ListInvite {
    /** Random opaque token, also the unique document id. */
    token: string;
    /** The list being shared. */
    listTitle: string;
    /** User id of the list owner who created the invite. */
    ownerId: string;
    /** Username cached at issue time so the unauthenticated preview is one read. */
    ownerUsername: string;
    createdAt: Date;
    /** When the token stops being redeemable. */
    expiresAt: Date;
    /** Set when the owner revokes the invite; further redemptions are refused. */
    revokedAt?: Date;
    /** Set when a user successfully claims the invite. */
    claimedBy?: string;
    claimedAt?: Date;
}

/** Minimal preview returned by the unauthenticated GET /api/lists/invites/:token. */
export interface ListInvitePreview {
    listTitle: string;
    ownerUsername: string;
    expiresAt: Date;
    /** True if the token is revoked, expired or already claimed. UI shows a friendly message instead of join CTAs. */
    isClosed: boolean;
    /** True if the previewer is the owner (so the UI offers a revoke button). */
    isOwner: boolean;
}

export { expandOccurrences, isoDay, type Occurrence, occursOn, parseDay } from './recurrence';
