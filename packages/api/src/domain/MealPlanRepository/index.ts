import type { MealPlanEntry } from '@tandra/types';

export interface MealPlanRepository {
    ensureIndexes(): Promise<void>;
    getById(entryId: string): Promise<MealPlanEntry | null>;
    /** Entries the user owns or is a shared member of, with `date` in [from, to] (inclusive YYYY-MM-DD). */
    findForUserBetween(userId: string, from: string, to: string): Promise<MealPlanEntry[]>;
    insert(entry: MealPlanEntry): Promise<MealPlanEntry>;
    update(entryId: string, entry: MealPlanEntry): Promise<MealPlanEntry>;
    deleteById(entryId: string): Promise<void>;
    /** Remove memberId from users[] on every entry owned by ownerId. */
    removeMemberFromAll(memberId: string, ownerId: string): Promise<void>;
    deleteOwnedBy(userId: string): Promise<void>;
    /** Removes the user from `users[]` on every entry, whoever owns it. */
    removeMemberEverywhere(memberId: string): Promise<void>;
}
