import type { User } from '@tandra/types';

/** Anything that has an owner and a member list: lists, recipes, todos. */
export interface Owned {
    ownerId?: string;
    users?: Array<User>;
}

/**
 * Service for managing authorization and permissions in lists
 * Handles owner verification and user management permissions
 */
export class AuthorizationService {
    /**
     * Check if user is the owner of the list
     * For backward compatibility: if no ownerId, check if user is first in users array
     */
    isOwner(entity: Owned, userId: string): boolean {
        if (entity.ownerId) {
            return entity.ownerId === userId;
        }

        // Backward compatibility: assume first user is owner
        return entity.users?.[0]?.id === userId;
    }

    /** Same check, named for the lists it was written for. */
    isListOwner(list: Owned, userId: string): boolean {
        return this.isOwner(list, userId);
    }

    /**
     * Check if user can manage (add/remove) users
     * Currently same as isListOwner, but separate for future role-based permissions
     */
    canManageUsers(list: Owned, userId: string): boolean {
        return this.isListOwner(list, userId);
    }

    /**
     * Get the effective owner ID for a list
     * Returns ownerId if set, otherwise first user's ID
     */
    getEffectiveOwnerId(list: Owned): string | null {
        if (list.ownerId) {
            return list.ownerId;
        }

        return list.users?.[0]?.id || null;
    }
}
