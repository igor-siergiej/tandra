import type { Friendship, User } from '@tandra/types';

interface SharedItem {
    ownerId?: string;
    users: User[];
}

interface FriendPair {
    userIds: [string, string];
    users: [User, User];
}

const sortPair = (a: User, b: User): FriendPair =>
    a.id < b.id ? { userIds: [a.id, b.id], users: [a, b] } : { userIds: [b.id, a.id], users: [b, a] };

/** Canonical, deduped owner↔member pairs from a set of shared items. */
export const pairsFromItems = (items: SharedItem[]): FriendPair[] => {
    const seen = new Set<string>();
    const out: FriendPair[] = [];

    for (const item of items) {
        const owner = item.users.find((u) => u.id === item.ownerId) ?? item.users[0];

        if (!owner) continue;

        for (const member of item.users) {
            if (member.id === owner.id) continue;
            const pair = sortPair(owner, member);
            const key = pair.userIds.join('|');

            if (seen.has(key)) continue;
            seen.add(key);
            out.push(pair);
        }
    }

    return out;
};

export interface MigrationDeps {
    listRepo: { getAll(): Promise<SharedItem[]> };
    recipeRepo: { getAll(): Promise<SharedItem[]> };
    friendRepo: {
        findPair(a: string, b: string): Promise<Friendship | null>;
        insertFriendship(f: Friendship): Promise<void>;
    };
    idGenerator: { generate(): string };
}

export const migrateFriendsFromExistingShares = async (deps: MigrationDeps): Promise<{ created: number }> => {
    const items = [...(await deps.listRepo.getAll()), ...(await deps.recipeRepo.getAll())];
    const pairs = pairsFromItems(items);
    let created = 0;

    for (const pair of pairs) {
        if (await deps.friendRepo.findPair(pair.userIds[0], pair.userIds[1])) continue; // idempotent
        await deps.friendRepo.insertFriendship({ id: deps.idGenerator.generate(), ...pair, createdAt: new Date() });
        created += 1;
    }

    return { created };
};
