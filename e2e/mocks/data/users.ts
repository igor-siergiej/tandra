import type { User } from '@tandra/types';

// Seeded into Better Auth by global-setup with these exact ids (Mongo ObjectIds, like real accounts),
// so specs can reference a user's id without asking the api first.
export const MOCK_USER: User = { id: '6e2e00000000000000000001', username: 'testuser' };
export const MOCK_USER_2: User = { id: '6e2e00000000000000000002', username: 'otheruser' };

const PASSWORDS = new Map([
    [MOCK_USER.username, 'password123'],
    [MOCK_USER_2.username, 'password123'],
]);

/** The password global-setup seeds for one of the mock users. */
export const passwordFor = (user: User): string => {
    const password = PASSWORDS.get(user.username);

    if (password === undefined) throw new Error(`no seeded password for ${user.username}`);

    return password;
};
