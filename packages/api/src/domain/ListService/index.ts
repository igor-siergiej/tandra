import type { Logger } from '@imapps/api-utils';
import type { Item, ItemCategory, List, ListType, User } from '@tandra/types';
import { ITEM_CATEGORIES, ListType as ListTypeEnum } from '@tandra/types';

import { AuthorizationService } from '../AuthorizationService';
import type { FriendService } from '../FriendService';
import type { IdGenerator } from '../IdGenerator';
import type { ItemCategoryService } from '../ItemCategoryService';
import type { ListRepository } from '../ListRepository';
import type { NotificationService } from '../NotificationService';
import { resolveFriendMembers } from '../SharedMembers';
import { isMergeableIngredient, resolveMergedQuantity, resolveMergedUnit } from './ingredientMatching';

// How many times a contended list write is re-read and retried before giving up.
const MAX_WRITE_ATTEMPTS = 8;

// Bounds the LLM calls one add can trigger when a long-standing list has many unclassified items.
const MAX_CATEGORISE_PER_PASS = 30;

// Minimum gap between fetch-triggered categorisation passes per list, so a failing classifier isn't hit on every read.
const BACKFILL_COOLDOWN_MS = 60_000;

export class ListService {
    private readonly authorizationService: AuthorizationService;
    private readonly categorising = new Set<string>();
    private readonly lastBackfill = new Map<string, number>();

    constructor(
        private readonly repo: ListRepository,
        private readonly idGenerator: IdGenerator,
        private readonly logger?: Logger,
        authorizationService?: AuthorizationService,
        private readonly notificationService?: NotificationService,
        private readonly friendService?: FriendService,
        private readonly itemCategoryService?: ItemCategoryService,
        private readonly onListChanged?: (listTitle: string) => void
    ) {
        this.authorizationService = authorizationService ?? new AuthorizationService();
    }

    /**
     * Fills in aisles for items that have none, after the add response is already sent. Failures leave the item
     * uncategorised (shown under "other") and never surface to the caller.
     */
    private async categoriseInBackground(ref: string): Promise<void> {
        if (!this.itemCategoryService || this.categorising.has(ref)) return;
        this.categorising.add(ref);

        try {
            const list = await this.repo.getByRef(ref);

            if (!list) return;
            const pending = list.items.filter((item) => !item.category).slice(0, MAX_CATEGORISE_PER_PASS);
            let changed = false;

            for (const item of pending) {
                const category = await this.itemCategoryService.categorise(item.name);

                if (category && (await this.repo.setCategoryIfUnset(list.id, item.id, category))) changed = true;
            }

            if (changed) this.onListChanged?.(list.id);
        } catch (error) {
            this.logger?.warn('Background item categorisation failed', { listRef: ref, error });
        } finally {
            this.categorising.delete(ref);
        }
    }

    /** Picks up items that never got an aisle (added before grouping shipped, or while the classifier was failing). */
    private backfillCategories(list: List): void {
        if (!this.itemCategoryService || list.items.every((item) => item.category)) return;
        const now = Date.now();

        if (now - (this.lastBackfill.get(list.id) ?? 0) < BACKFILL_COOLDOWN_MS) return;
        this.lastBackfill.set(list.id, now);
        void this.categoriseInBackground(list.id);
    }

    async setItemCategory(title: string, itemId: string, category: ItemCategory) {
        if (!ITEM_CATEGORIES.includes(category)) {
            throw Object.assign(new Error('Unknown item category'), { status: 400 });
        }

        await this.modifyList(title, (list) => {
            this.findItem(list, itemId);
            list.items = list.items.map((item) => (item.id === itemId ? { ...item, category } : item));
        });
        this.logger?.info('Item category set by user', { listTitle: title, itemId, category });

        return { message: 'Category updated successfully' };
    }

    private findItem(list: List, itemId: string): Item {
        const item = list.items.find((i) => i.id === itemId);

        if (!item) {
            throw Object.assign(new Error('Item not found'), { status: 404 });
        }

        return item;
    }

    /**
     * Read-modify-write on one list that cannot silently drop a concurrent edit. `mutate` edits the list it is
     * handed; the write only lands if nobody changed the list since it was read, otherwise the list is re-read
     * and `mutate` runs again on the fresh copy. So `mutate` must be safe to re-run, and it aborts by throwing
     * (404/409 and friends are never retried).
     */
    private async modifyList<T>(
        title: string,
        mutate: (list: List) => T | Promise<T>
    ): Promise<{ list: List; result: T }> {
        for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
            const list = await this.repo.getByRef(title);

            if (!list) {
                throw Object.assign(new Error('List not found'), { status: 404 });
            }

            const result = await mutate(list);
            const revision = await this.repo.replaceIfUnchanged(list.id, list);

            if (revision !== null) {
                list.revision = revision;

                return { list, result };
            }
        }

        throw Object.assign(new Error('List is being edited too quickly, please try again'), { status: 503 });
    }

    /** Owner first, then the friends the list is shared with (all by default, or the chosen subset). */
    private async resolveSharedUsers(
        title: string,
        owner: User,
        selectedFriendIds?: Array<string>
    ): Promise<Array<User>> {
        const members = await resolveFriendMembers(this.friendService, owner.id, selectedFriendIds);

        this.logger?.info(
            selectedFriendIds === undefined ? 'List auto-shared with friends' : 'List shared with selected friends',
            {
                listTitle: title,
                owner: owner.username,
                sharedWithCount: members.length,
            }
        );

        return [owner, ...members];
    }

    async getList(title: string): Promise<List> {
        const list = await this.repo.getByRef(title);

        if (!list) {
            throw Object.assign(new Error('List not found'), { status: 404 });
        }

        // Backward compatibility: default to SHOPPING if listType is missing
        if (!list.listType) {
            this.logger?.warn('List missing listType field, defaulting to SHOPPING', {
                listTitle: title,
            });
            list.listType = ListTypeEnum.SHOPPING;
        }

        this.backfillCategories(list);

        return list;
    }

    async getListsForUser(userId: string) {
        if (!userId) {
            throw Object.assign(new Error('userId is required'), { status: 400 });
        }

        try {
            const lists = await this.repo.findByUserId(userId);
            this.logger?.info('Retrieved lists for user', { userId, count: lists.length });

            return lists.map((list) => ({
                id: list.id,
                title: list.title,
                dateAdded: list.dateAdded,
                items: list.items,
                users: list.users.map((user) => ({ username: user.username })),
                listType: list.listType || ListTypeEnum.SHOPPING,
                ownerId: this.authorizationService.getEffectiveOwnerId(list),
            }));
        } catch (error) {
            this.logger?.error('Failed to retrieve lists for user', { userId, error });
            throw error;
        }
    }

    async addList(
        title: string,
        dateAdded: Date,
        owner: User,
        selectedFriendIds?: Array<string>,
        listType: ListType = ListTypeEnum.SHOPPING,
        id?: string
    ) {
        try {
            const replay = id ? await this.repo.getByRef(id) : null;

            if (replay && replay.id === id) {
                return replay; // idempotent replay
            }

            // Titles are display-only now, so they may repeat across users; one person still can't hold two with the same name.
            if ((await this.repo.findByUserId(owner.id)).some((existing) => existing.title === title)) {
                throw Object.assign(new Error('A list with that name already exists'), { status: 409 });
            }

            const users = await this.resolveSharedUsers(title, owner, selectedFriendIds);

            const list: List = {
                id: id ?? this.idGenerator.generate(),
                title,
                dateAdded,
                items: [],
                users,
                listType,
                ownerId: owner.id,
            };

            await this.repo.insert(list);
            this.logger?.info('List created', {
                listId: list.id,
                listTitle: title,
                owner: owner.username,
                userCount: users.length,
                listType,
            });

            return list;
        } catch (error) {
            this.logger?.error('Failed to create list', {
                listTitle: title,
                owner: owner.username,
                error,
            });
            throw error;
        }
    }

    async addItem(
        title: string,
        itemName: string,
        dateAdded: Date,
        quantity?: number,
        unit?: string,
        actor?: User,
        id?: string
    ) {
        try {
            const list = await this.repo.getByRef(title);

            if (!list) {
                throw Object.assign(new Error('List not found'), { status: 404 });
            }

            if (id) {
                const already = list.items.find((i) => i.id === id);

                if (already) return already;
            }

            // Check if an item with the same name already exists (case-insensitive)
            const existingItem = list.items.find((item) => item.name.toLowerCase() === itemName.toLowerCase());

            if (existingItem) {
                throw Object.assign(new Error('An item with that name already exists in this list'), { status: 409 });
            }

            const item: Item = {
                id: id ?? this.idGenerator.generate(),
                name: itemName,
                dateAdded,
                isSelected: false,
                ...(quantity !== undefined && { quantity }),
                ...(unit !== undefined && { unit }),
            };

            await this.repo.pushItem(list.id, item);
            void this.categoriseInBackground(list.id);
            this.logger?.info('Item added to list', {
                listTitle: title,
                itemName,
                itemId: item.id,
                quantity,
                unit,
            });

            if (actor) {
                void this.notificationService?.notifyItemAdded(list, item, actor);
            }

            return item;
        } catch (error) {
            this.logger?.error('Failed to add item to list', { listTitle: title, itemName, error });
            throw error;
        }
    }

    async updateItemName(title: string, itemId: string, newItemName: string) {
        try {
            if (!newItemName || newItemName.trim() === '') {
                throw Object.assign(new Error('New title cannot be empty'), {
                    status: 400,
                });
            }

            const trimmedName = newItemName.trim();

            await this.modifyList(title, (list) => {
                const target = this.findItem(list, itemId);

                if (trimmedName === target.name) {
                    throw Object.assign(new Error('New item name must be different from current name'), {
                        status: 400,
                    });
                }

                const clash = list.items.find((i) => i.id !== itemId && i.name === trimmedName);

                if (clash) {
                    throw Object.assign(new Error('An item with that name already exists in this list'), {
                        status: 409,
                    });
                }

                list.items = list.items.map((item) => (item.id === itemId ? { ...item, name: trimmedName } : item));
            });

            this.logger?.info('Item name updated', {
                listTitle: title,
                itemId,
                newItemName: trimmedName,
            });

            return {
                message: 'Item updated successfully',
                newItemName: trimmedName,
            };
        } catch (error) {
            this.logger?.error('Failed to update item name', {
                listTitle: title,
                itemId,
                newItemName,
                error,
            });
            throw error;
        }
    }

    async setItemSelected(title: string, itemId: string, isSelected: boolean) {
        try {
            await this.modifyList(title, (list) => {
                this.findItem(list, itemId);
                list.items = list.items.map((item) => (item.id === itemId ? { ...item, isSelected } : item));
            });

            this.logger?.info('Item selection updated', {
                listTitle: title,
                itemId,
                isSelected,
            });

            return { message: 'Updated Successfully' };
        } catch (error) {
            this.logger?.error('Failed to update item selection', {
                listTitle: title,
                itemId,
                isSelected,
                error,
            });
            throw error;
        }
    }

    async updateItemQuantity(title: string, itemId: string, quantity?: number, unit?: string) {
        try {
            await this.modifyList(title, (list) => {
                this.findItem(list, itemId);
                list.items = list.items.map((item) =>
                    item.id === itemId
                        ? {
                              ...item,
                              ...(quantity !== undefined && { quantity }),
                              ...(unit !== undefined && { unit }),
                          }
                        : item
                );
            });

            this.logger?.info('Item quantity updated', {
                listTitle: title,
                itemId,
                quantity,
                unit,
            });

            return { message: 'Quantity updated successfully' };
        } catch (error) {
            this.logger?.error('Failed to update item quantity', {
                listTitle: title,
                itemId,
                quantity,
                unit,
                error,
            });
            throw error;
        }
    }

    async clearSelectedItems(title: string) {
        try {
            const { list, result: selectedCount } = await this.modifyList(title, (current) => {
                const selected = current.items.filter((item) => item.isSelected).length;
                current.items = current.items.filter((item) => !item.isSelected);

                return selected;
            });

            this.logger?.info('Selected items cleared from list', {
                listTitle: title,
                clearedItemCount: selectedCount,
                remainingItemCount: list.items.length,
            });

            return list;
        } catch (error) {
            this.logger?.error('Failed to clear selected items', { listTitle: title, error });
            throw error;
        }
    }

    async deleteItem(title: string, itemId: string) {
        try {
            const { list } = await this.modifyList(title, (current) => {
                this.findItem(current, itemId);
                current.items = current.items.filter((item) => item.id !== itemId);
            });

            this.logger?.info('Item deleted from list', {
                listTitle: title,
                itemId,
                remainingItemCount: list.items.length,
            });

            return list;
        } catch (error) {
            this.logger?.error('Failed to delete item', { listTitle: title, itemId, error });
            throw error;
        }
    }

    async updateListTitle(title: string, newTitle: string) {
        try {
            if (!newTitle || newTitle.trim() === '') {
                throw Object.assign(new Error('New title cannot be empty'), {
                    status: 400,
                });
            }

            const { list } = await this.modifyList(title, async (current) => {
                const owned = current.ownerId ? await this.repo.findByUserId(current.ownerId) : [];

                if (owned.some((other) => other.id !== current.id && other.title === newTitle.trim())) {
                    throw Object.assign(new Error('A list with that name already exists'), {
                        status: 409,
                    });
                }

                current.title = newTitle.trim();
            });

            this.logger?.info('List renamed', {
                oldTitle: title,
                newTitle: newTitle.trim(),
                itemCount: list.items.length,
            });

            return { message: 'List updated successfully', newTitle: newTitle.trim() };
        } catch (error) {
            this.logger?.error('Failed to update list title', {
                oldTitle: title,
                newTitle,
                error,
            });
            throw error;
        }
    }

    async deleteList(title: string) {
        try {
            const list = await this.repo.getByRef(title);

            if (list) await this.repo.deleteById(list.id);

            this.logger?.info('List deleted', { listTitle: title });

            return { message: 'List deleted successfully' };
        } catch (error) {
            this.logger?.error('Failed to delete list', { listTitle: title, error });
            throw error;
        }
    }

    async clearList(title: string) {
        try {
            const { list, result: clearedCount } = await this.modifyList(title, (current) => {
                const count = current.items.length;
                current.items = [];

                return count;
            });

            this.logger?.info('List cleared', { listTitle: title, clearedItemCount: clearedCount });

            return list;
        } catch (error) {
            this.logger?.error('Failed to clear list', { listTitle: title, error });
            throw error;
        }
    }

    /**
     * Add a user to a list as the result of redeeming a list-invite token.
     * Skips the owner-only check (the redeem path is its own authorisation) but
     * still refuses duplicates and notifies the realtime hub so existing members
     * see the joiner live. The caller passes the claimer's full `User` so we do
     * not need a second round-trip to friends.
     */
    async addInvitedUser(title: string, claimer: User, ownerId: string): Promise<List> {
        const { list, result: added } = await this.modifyList(title, (current) => {
            if (current.ownerId !== ownerId) {
                throw Object.assign(new Error('List not found'), { status: 404 });
            }

            if (current.users.some((u) => u.id === claimer.id)) {
                throw Object.assign(new Error('User is already in this list'), { status: 400 });
            }

            current.users.push(claimer);

            return claimer;
        });

        this.logger?.info('User joined via invite', {
            listTitle: title,
            joinedUser: added.username,
            invitedBy: ownerId,
        });

        return list;
    }

    /**
     * Add a friend to an existing list
     * Only the list owner can add users, and only friends of the owner can be added
     */
    async addUserToList(title: string, friendId: string, requestingUserId: string): Promise<List> {
        const { list, result: friend } = await this.modifyList(title, async (current) => {
            // Authorization: only owner can add users
            if (!this.authorizationService.canManageUsers(current, requestingUserId)) {
                throw Object.assign(new Error('Only the list owner can manage users'), { status: 403 });
            }

            // Validate friendship by id
            if (!this.friendService || !(await this.friendService.areFriends(requestingUserId, friendId))) {
                throw Object.assign(new Error('Can only share with friends'), { status: 403 });
            }

            // Check if user is already in the list
            if (current.users.some((u) => u.id === friendId)) {
                throw Object.assign(new Error('User is already in this list'), { status: 400 });
            }

            const [newMember] = (await this.friendService.listFriends(requestingUserId)).filter(
                (f) => f.id === friendId
            );

            current.users.push(newMember);

            return newMember;
        });

        this.logger?.info('User added to list', {
            listTitle: title,
            addedUser: friend.username,
            addedBy: requestingUserId,
        });

        return list;
    }

    /**
     * Remove a user from an existing list
     * Only the list owner can remove users
     */
    async removeUserFromList(title: string, userIdToRemove: string, requestingUserId: string): Promise<List> {
        const { list } = await this.modifyList(title, (current) => {
            // Authorization: only owner can remove users
            if (!this.authorizationService.canManageUsers(current, requestingUserId)) {
                throw Object.assign(new Error('Only the list owner can manage users'), { status: 403 });
            }

            // Cannot remove the owner
            const effectiveOwnerId = this.authorizationService.getEffectiveOwnerId(current);

            if (userIdToRemove === effectiveOwnerId) {
                throw Object.assign(new Error('Cannot remove the list owner'), { status: 400 });
            }

            // Cannot remove the last user
            if (current.users.length <= 1) {
                throw Object.assign(new Error('Cannot remove the last user from the list'), { status: 400 });
            }

            // Check if user is in the list
            const userExists = current.users.some((u) => u.id === userIdToRemove);

            if (!userExists) {
                throw Object.assign(new Error('User is not in this list'), { status: 400 });
            }

            current.users = current.users.filter((u) => u.id !== userIdToRemove);
        });

        this.logger?.info('User removed from list', {
            listTitle: title,
            removedUserId: userIdToRemove,
            removedBy: requestingUserId,
        });

        return list;
    }

    async addItems(
        title: string,
        rawItems: Array<{ itemName: string; quantity?: number; unit?: string; dateAdded: Date }>,
        userId: string,
        actor?: User
    ): Promise<{ added: number; skipped: number }> {
        try {
            const {
                list,
                result: { added, skipped, addedNames },
            } = await this.modifyList(title, (current) => {
                // Working copy: existing items plus any rows this same batch adds, so two
                // near-duplicate ingredients from the same recipe also merge into one row,
                // not just against what was already on the list.
                const items = [...current.items];
                const names: string[] = [];
                let addedCount = 0;
                let skippedCount = 0;

                for (const raw of rawItems) {
                    const matchIndex = items.findIndex((item) =>
                        isMergeableIngredient(item, { name: raw.itemName, unit: raw.unit })
                    );

                    if (matchIndex === -1) {
                        const item: Item = {
                            id: this.idGenerator.generate(),
                            name: raw.itemName,
                            dateAdded: raw.dateAdded,
                            isSelected: false,
                            ...(raw.quantity !== undefined && { quantity: raw.quantity }),
                            ...(raw.unit !== undefined && { unit: raw.unit }),
                        };

                        items.push(item);
                        names.push(item.name);
                        addedCount++;
                    } else {
                        const existing = items[matchIndex];
                        const mergedQuantity = resolveMergedQuantity(existing.quantity, raw.quantity);
                        const mergedUnit = resolveMergedUnit(existing.unit, raw.unit);
                        items[matchIndex] = {
                            ...existing,
                            ...(mergedQuantity !== undefined && { quantity: mergedQuantity }),
                            ...(mergedUnit !== undefined && { unit: mergedUnit }),
                        };
                        skippedCount++;
                    }
                }

                current.items = items;

                return { added: addedCount, skipped: skippedCount, addedNames: names };
            });

            if (added > 0) void this.categoriseInBackground(list.id);

            this.logger?.info('Items bulk added to list', {
                listTitle: title,
                userId,
                addedCount: added,
                skippedCount: skipped,
            });

            if (actor && addedNames.length > 0) {
                void this.notificationService?.notifyItemsAdded(list, addedNames, actor);
            }

            return { added, skipped };
        } catch (error) {
            this.logger?.error('Failed to add items to list', { listTitle: title, userId, error });
            throw error;
        }
    }
}
