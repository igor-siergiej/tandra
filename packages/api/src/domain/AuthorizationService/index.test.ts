import { beforeEach, describe, expect, it } from 'bun:test';

import type { List } from '@tandra/types';

import { AuthorizationService } from './index';

describe('AuthorizationService', () => {
    let authService: AuthorizationService;

    beforeEach(() => {
        authService = new AuthorizationService();
    });

    describe('isListOwner', () => {
        it('returns true when user is list owner via ownerId', () => {
            const userId = 'user-123';

            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [],
                ownerId: userId,
                listType: 'shopping',
            };

            expect(authService.isListOwner(list, userId)).toBe(true);
        });

        it('returns false when user is not list owner', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [{ id: 'owner-123', username: 'owner' }],
                ownerId: 'owner-123',
                listType: 'shopping',
            };

            expect(authService.isListOwner(list, 'user-456')).toBe(false);
        });

        it('returns true when user is first in users array (backward compatibility)', () => {
            const userId = 'user-123';

            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: userId, username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                listType: 'shopping',
            };

            expect(authService.isListOwner(list, userId)).toBe(true);
        });

        it('returns false when user is not first in users array', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'user-1', username: 'user1' },
                    { id: 'user-456', username: 'user2' },
                ],
                listType: 'shopping',
            };

            expect(authService.isListOwner(list, 'user-456')).toBe(false);
        });
    });

    describe('canManageUsers', () => {
        it('returns true when user is list owner via ownerId', () => {
            const userId = 'user-123';

            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [],
                ownerId: userId,
                listType: 'shopping',
            };

            expect(authService.canManageUsers(list, userId)).toBe(true);
        });

        it('returns false when user is not list owner', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [],
                ownerId: 'owner-123',
                listType: 'shopping',
            };

            expect(authService.canManageUsers(list, 'user-456')).toBe(false);
        });

        it('returns true for backward compatible first user', () => {
            const userId = 'user-123';

            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: userId, username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                listType: 'shopping',
            };

            expect(authService.canManageUsers(list, userId)).toBe(true);
        });

        it('returns false for backward compatible non-first user when no ownerId', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'user-1', username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                listType: 'shopping',
            };

            expect(authService.canManageUsers(list, 'user-2')).toBe(false);
        });
    });

    describe('getEffectiveOwnerId', () => {
        it('returns ownerId when it exists', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'user-1', username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                ownerId: 'owner-123',
                listType: 'shopping',
            };

            expect(authService.getEffectiveOwnerId(list)).toBe('owner-123');
        });

        it('returns first user ID when ownerId is not set', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'user-1', username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                listType: 'shopping',
            };

            expect(authService.getEffectiveOwnerId(list)).toBe('user-1');
        });

        it('returns null when list has no owner or users', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [],
                listType: 'shopping',
            };

            expect(authService.getEffectiveOwnerId(list)).toBeNull();
        });

        it('prefers ownerId over first user', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'user-1', username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                ownerId: 'explicit-owner',
                listType: 'shopping',
            };

            expect(authService.getEffectiveOwnerId(list)).toBe('explicit-owner');
        });
    });

    describe('permission scenarios', () => {
        it('handles migration from users-based to explicit owner', () => {
            const userId = 'user-1';

            // Old list (no ownerId, first user is owner)
            const oldList: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: userId, username: 'user1' },
                    { id: 'user-2', username: 'user2' },
                ],
                listType: 'shopping',
            };

            expect(authService.isListOwner(oldList, userId)).toBe(true);
            expect(authService.canManageUsers(oldList, userId)).toBe(true);
        });

        it('restricts non-owners from managing users', () => {
            const list: List = {
                id: 'list-1',
                title: 'Test',
                dateAdded: new Date(),
                items: [],
                users: [
                    { id: 'owner-1', username: 'owner' },
                    { id: 'user-2', username: 'member' },
                ],
                ownerId: 'owner-1',
                listType: 'shopping',
            };

            expect(authService.canManageUsers(list, 'user-2')).toBe(false);
            expect(authService.canManageUsers(list, 'owner-1')).toBe(true);
        });
    });

    describe('isOwner', () => {
        it('works for anything with an owner and members, such as a recipe', () => {
            const recipe = { ownerId: 'u1', users: [{ id: 'u2', username: 'two' }] };

            expect(authService.isOwner(recipe, 'u1')).toBe(true);
            expect(authService.isOwner(recipe, 'u2')).toBe(false);
        });

        it('falls back to the first member when there is no ownerId, and to nobody when there are no members', () => {
            expect(authService.isOwner({ users: [{ id: 'u2', username: 'two' }] }, 'u2')).toBe(true);
            expect(authService.isOwner({}, 'u2')).toBe(false);
        });

        it('is what isListOwner delegates to', () => {
            expect(authService.isListOwner({ ownerId: 'u1', users: [] }, 'u1')).toBe(true);
        });
    });
});
