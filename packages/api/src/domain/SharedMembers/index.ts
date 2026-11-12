import type { User } from '@tandra/types';

import type { FriendService } from '../FriendService';

/**
 * The friends something is shared with: all of the owner's current friends by default, or just the chosen subset.
 * Choosing anyone who is not a friend is a 403. Without a friend service nothing is shared. The owner is not part of
 * the result; lists and recipes list the owner first themselves, todos and meal plans leave them implicit.
 */
export const resolveFriendMembers = async (
    friendService: Pick<FriendService, 'listFriends'> | undefined,
    ownerId: string,
    selectedFriendIds?: Array<string>
): Promise<Array<User>> => {
    if (!friendService) {
        return [];
    }

    const friends = await friendService.listFriends(ownerId);

    if (selectedFriendIds === undefined) {
        return friends;
    }

    const allowed = new Set(friends.map((friend) => friend.id));

    if (selectedFriendIds.some((id) => !allowed.has(id))) {
        throw Object.assign(new Error('Can only share with friends'), { status: 403 });
    }

    return friends.filter((friend) => selectedFriendIds.includes(friend.id));
};
