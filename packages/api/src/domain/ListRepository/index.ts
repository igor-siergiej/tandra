import type { Item, ItemCategory, List } from '@tandra/types';

export interface ListRepository {
    ensureIndexes(): Promise<void>;
    /** Resolves a list reference: its id, or (for links, notifications and offline intents made before ids were used) its title. */
    getByRef(ref: string): Promise<List | null>;
    getAll(): Promise<Array<List>>;
    findByUserId(userId: string): Promise<Array<List>>;
    insert(list: List): Promise<void>;
    deleteById(listId: string): Promise<void>;
    /**
     * Replaces the list with `listId` only if its `revision` still equals `list.revision` (the value read
     * with it). Returns the new revision, or null when the list changed or vanished in the meantime.
     */
    replaceIfUnchanged(listId: string, list: List): Promise<number | null>;
    pushItem(listId: string, item: Item): Promise<void>;
    /** Sets an item's category only while it has none, so a user's choice always wins over the classifier. */
    setCategoryIfUnset(listId: string, itemId: string, category: ItemCategory): Promise<boolean>;
    removeMemberFromAll(memberId: string, ownerId: string): Promise<void>;
    /** Deletes every list the user owns (a legacy list with no owner counts when they are its only member). */
    deleteOwnedBy(userId: string): Promise<void>;
    /** Removes the user from `users[]` on every list, whoever owns it. */
    removeMemberEverywhere(memberId: string): Promise<void>;
}
