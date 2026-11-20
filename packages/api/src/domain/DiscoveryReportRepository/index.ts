export interface DiscoveryReport {
    id: string;
    /** Library recipe id. */
    recipeId: string;
    reporterId: string;
    reason?: string;
    createdAt: Date;
}

export interface DiscoveryReportRepository {
    ensureIndexes(): Promise<void>;
    /** One report per reporter per recipe: reporting again replaces the earlier reason. */
    upsert(report: DiscoveryReport): Promise<void>;
    listAll(): Promise<DiscoveryReport[]>;
    deleteByRecipeId(recipeId: string): Promise<void>;
    deleteByReporterId(reporterId: string): Promise<void>;
}
