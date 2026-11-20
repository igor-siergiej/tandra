/** A published recipe's server-side back-reference. Kept apart from the library so the public document carries no owner. */
export interface DiscoveryPublication {
    recipeId: string;
    libraryId: string;
    ownerId: string;
    /** Absent while a first publish has not finished: a retry then reuses `libraryId` instead of minting a second recipe. */
    publishedAt?: Date;
}

/** Which personal recipe each user-published library recipe came from, and who owns it. Never returned by a public endpoint. */
export interface DiscoveryPublicationRepository {
    ensureIndexes(): Promise<void>;
    getByRecipeId(recipeId: string): Promise<DiscoveryPublication | null>;
    getByLibraryId(libraryId: string): Promise<DiscoveryPublication | null>;
    /** Finished publications only. */
    listPublishedByOwner(ownerId: string): Promise<DiscoveryPublication[]>;
    upsert(publication: DiscoveryPublication): Promise<void>;
    deleteByLibraryId(libraryId: string): Promise<void>;
    /** Every publication the user owns, including a first publish that never finished. */
    listAllByOwner(ownerId: string): Promise<DiscoveryPublication[]>;
}
