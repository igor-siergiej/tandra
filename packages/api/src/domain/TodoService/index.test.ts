import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { Todo } from '@tandra/types';

import { fake } from '../../testing/fake';
import { TodoService } from './index';

class MockRepo {
    store = new Map<string, Todo>();
    cleared: Array<{ labelId: string; ownerId: string }> = [];
    async insert(t: Todo) {
        this.store.set(t.id, t);

        return t;
    }
    async getById(id: string) {
        return this.store.get(id) ?? null;
    }
    async findByOwnerId(ownerId: string) {
        return [...this.store.values()].filter((t) => t.ownerId === ownerId);
    }
    async findByMember(userId: string) {
        return [...this.store.values()].filter((t) => t.users?.some((u) => u.id === userId));
    }
    async update(id: string, t: Todo) {
        this.store.set(id, t);

        return t;
    }
    async deleteById(id: string) {
        this.store.delete(id);
    }
    async clearLabel(labelId: string, ownerId: string) {
        this.cleared.push({ labelId, ownerId });
    }
}

class MockIds {
    private n = 0;
    generate() {
        this.n += 1;

        return `id-${this.n}`;
    }
}

class MockFriends {
    edges = new Set<string>(); // "a|b" sorted
    private key(a: string, b: string) {
        return [a, b].sort().join('|');
    }
    add(a: string, b: string) {
        this.edges.add(this.key(a, b));
    }
    async areFriends(a: string, b: string) {
        return this.edges.has(this.key(a, b));
    }
    async friendIdsOf(userId: string) {
        return [...this.edges].flatMap((edge) => {
            const [a, b] = edge.split('|');

            if (a === userId) return [b];

            return b === userId ? [a] : [];
        });
    }
    async listFriends(userId: string) {
        return (await this.friendIdsOf(userId)).map((id) => ({ id, username: `user-${id}` }));
    }
}

describe('TodoService', () => {
    let repo: MockRepo;
    let friends: MockFriends;
    let svc: TodoService;

    beforeEach(() => {
        repo = new MockRepo();
        friends = new MockFriends();
        svc = new TodoService(fake(repo), fake(new MockIds()), undefined, fake(friends));
    });

    it('creates a todo with id, ownerId, dateAdded, done=false', async () => {
        const todo = await svc.createTodo('u1', { title: 'Buy milk' });
        expect(todo.id).toBe('id-1');
        expect(todo.ownerId).toBe('u1');
        expect(todo.done).toBe(false);
        expect(todo.dateAdded).toBeInstanceOf(Date);
    });

    it('lists todos for the owner only', async () => {
        await svc.createTodo('u1', { title: 'A' });
        await svc.createTodo('u2', { title: 'B' });
        const mine = await svc.getTodosByOwner('u1');
        expect(mine).toHaveLength(1);
        expect(mine[0].title).toBe('A');
    });

    it('updates an owned todo', async () => {
        const t = await svc.createTodo('u1', { title: 'A' });
        const updated = await svc.updateTodo(t.id, 'u1', { title: 'A2' });
        expect(updated.title).toBe('A2');
    });

    it('removes the fields named in clear and keeps the rest', async () => {
        const t = await svc.createTodo('u1', { title: 'A', dueDate: '2026-06-29', time: '09:30', labelId: 'L1' });
        const updated = await svc.updateTodo(t.id, 'u1', { title: 'B', clear: ['time', 'labelId'] });
        expect(updated.title).toBe('B');
        expect(updated.dueDate).toBe('2026-06-29');
        expect(updated.time).toBeUndefined();
        expect(updated.labelId).toBeUndefined();
        expect('clear' in updated).toBe(false);
    });

    it('rejects update by a non-owner with 403', async () => {
        const t = await svc.createTodo('u1', { title: 'A' });
        expect(svc.updateTodo(t.id, 'intruder', { title: 'x' })).rejects.toMatchObject({ status: 403 });
    });

    it('rejects update of a missing todo with 404', async () => {
        expect(svc.updateTodo('nope', 'u1', { title: 'x' })).rejects.toMatchObject({ status: 404 });
    });

    it('deletes an owned todo', async () => {
        const t = await svc.createTodo('u1', { title: 'A' });
        await svc.deleteTodo(t.id, 'u1');
        expect(await repo.getById(t.id)).toBeNull();
    });

    it('rejects delete by non-owner with 403', async () => {
        const t = await svc.createTodo('u1', { title: 'A' });
        expect(svc.deleteTodo(t.id, 'intruder')).rejects.toMatchObject({ status: 403 });
    });

    it('toggles done for a non-recurring todo', async () => {
        const t = await svc.createTodo('u1', { title: 'A' });
        const on = await svc.toggleComplete(t.id, 'u1');
        expect(on.done).toBe(true);
        const off = await svc.toggleComplete(t.id, 'u1');
        expect(off.done).toBe(false);
    });

    it('adds and removes a date in completedDates for a recurring todo', async () => {
        const t = await svc.createTodo('u1', {
            title: 'Standup',
            recurrence: { freq: 'daily', interval: 1 },
        });

        const added = await svc.toggleComplete(t.id, 'u1', '2026-06-04');
        expect(added.completedDates).toEqual(['2026-06-04']);
        const removed = await svc.toggleComplete(t.id, 'u1', '2026-06-04');
        expect(removed.completedDates).toEqual([]);
    });

    it('keeps a YYYY-MM-DD dueDate as a day string on create', async () => {
        const t = await svc.createTodo('u1', { title: 'A', dueDate: '2026-06-29' });
        expect(t.dueDate).toBe('2026-06-29');
    });

    it('reduces a full ISO dueDate/until to its day part on create', async () => {
        const t = await svc.createTodo('u1', {
            title: 'A',
            dueDate: '2026-06-29T00:00:00.000Z',
            recurrence: { freq: 'daily', interval: 1, until: '2026-07-29T00:00:00.000Z' },
        });

        expect(t.dueDate).toBe('2026-06-29');
        expect(t.recurrence?.until).toBe('2026-07-29');
    });

    it('keeps a YYYY-MM-DD dueDate as a day string on update', async () => {
        const t = await svc.createTodo('u1', { title: 'A' });
        const updated = await svc.updateTodo(t.id, 'u1', { dueDate: '2026-06-29' });
        expect(updated.dueDate).toBe('2026-06-29');
    });

    describe('createTodo idempotency', () => {
        it('uses the caller-provided id when given', async () => {
            const todo = await svc.createTodo('user-1', { title: 'Buy milk', id: 'client-todo-uuid' });
            expect(todo.id).toBe('client-todo-uuid');
        });

        it('returns the existing todo without re-insert when id+owner already exist', async () => {
            const first = await svc.createTodo('user-1', { title: 'Buy milk', id: 'client-todo-uuid' });
            const second = await svc.createTodo('user-1', { title: 'Buy milk again', id: 'client-todo-uuid' });
            expect(second).toBe(first);
            expect(second.title).toBe('Buy milk');
            expect(await svc.getTodosByOwner('user-1')).toHaveLength(1);
        });
    });

    describe('friend-seeded sharing', () => {
        it("seeds users[] from the owner's current friends on create", async () => {
            friends.add('u1', 'u2');
            const todo = await svc.createTodo('u1', { title: 'Plan trip' });
            expect(todo.users).toEqual([{ id: 'u2', username: 'user-u2' }]);
        });

        it('accepts an explicit friend subset and rejects a non-friend (403)', async () => {
            friends.add('u1', 'u2');
            const ok = await svc.createTodo('u1', { title: 'A', userIds: ['u2'] });
            expect(ok.users?.map((u) => u.id)).toEqual(['u2']);
            await expect(svc.createTodo('u1', { title: 'B', userIds: ['u9'] })).rejects.toMatchObject({
                status: 403,
            });
        });

        it('getTodosForUser returns owned and shared todos', async () => {
            friends.add('u1', 'u2');
            await svc.createTodo('u1', { title: 'Owned by u1, shared to u2' });
            await svc.createTodo('u2', { title: 'Owned by u2' });
            const forU2 = await svc.getTodosForUser('u2');
            expect(forU2.map((t) => t.title).sort()).toEqual(['Owned by u1, shared to u2', 'Owned by u2']);
        });
    });

    describe('share notification', () => {
        it('notifies shared members when created with an actor', async () => {
            friends.add('u1', 'u2');
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            const actor = { id: 'u1', username: 'user-u1' };
            const todo = await svcWithNotify.createTodo('u1', { title: 'Plan trip' }, actor);
            expect(notify.notifyTodoShared).toHaveBeenCalledWith(todo, actor);
        });

        it('does not notify when created without any shared members', async () => {
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            await svcWithNotify.createTodo('u1', { title: 'Solo task' }, { id: 'u1', username: 'user-u1' });
            expect(notify.notifyTodoShared).not.toHaveBeenCalled();
        });

        it('does not notify when created without an actor, even if shared', async () => {
            friends.add('u1', 'u2');
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            await svcWithNotify.createTodo('u1', { title: 'Plan trip' });
            expect(notify.notifyTodoShared).not.toHaveBeenCalled();
        });
    });

    describe('edit-time sharing notification', () => {
        it('notifies only newly-added members when sharing is edited', async () => {
            friends.add('u1', 'u2');
            friends.add('u1', 'u3');
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            const actor = { id: 'u1', username: 'user-u1' };
            const t = await svcWithNotify.createTodo('u1', { title: 'Plan trip', userIds: ['u2'] }, actor);
            notify.notifyTodoShared.mockClear();

            const updated = await svcWithNotify.updateTodo(
                t.id,
                'u1',
                {
                    users: [
                        { id: 'u2', username: 'user-u2' },
                        { id: 'u3', username: 'user-u3' },
                    ],
                },
                actor
            );

            expect(notify.notifyTodoShared).toHaveBeenCalledTimes(1);
            expect(notify.notifyTodoShared).toHaveBeenCalledWith(
                { ...updated, users: [{ id: 'u3', username: 'user-u3' }] },
                actor
            );
        });

        it('does not notify when the edited users[] adds nobody new', async () => {
            friends.add('u1', 'u2');
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            const actor = { id: 'u1', username: 'user-u1' };
            const t = await svcWithNotify.createTodo('u1', { title: 'Plan trip', userIds: ['u2'] }, actor);
            notify.notifyTodoShared.mockClear();

            await svcWithNotify.updateTodo(t.id, 'u1', { users: [{ id: 'u2', username: 'user-u2' }] }, actor);

            expect(notify.notifyTodoShared).not.toHaveBeenCalled();
        });

        it('does not notify when the update has no users[] at all', async () => {
            friends.add('u1', 'u2');
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            const actor = { id: 'u1', username: 'user-u1' };
            const t = await svcWithNotify.createTodo('u1', { title: 'Plan trip' }, actor);
            notify.notifyTodoShared.mockClear();

            await svcWithNotify.updateTodo(t.id, 'u1', { title: 'Renamed' }, actor);

            expect(notify.notifyTodoShared).not.toHaveBeenCalled();
        });

        it('does not notify without an actor, even when adding a member', async () => {
            friends.add('u1', 'u2');
            const notify = { notifyTodoShared: mock(async () => {}) };

            const svcWithNotify = new TodoService(
                fake(repo),
                fake(new MockIds()),
                undefined,
                fake(friends),
                fake(notify)
            );

            const t = await svcWithNotify.createTodo('u1', { title: 'Plan trip' });

            await svcWithNotify.updateTodo(t.id, 'u1', { users: [{ id: 'u2', username: 'user-u2' }] });

            expect(notify.notifyTodoShared).not.toHaveBeenCalled();
        });
    });

    describe('collaborative shared todos', () => {
        it('lets a member toggle complete on a shared todo', async () => {
            friends.add('u1', 'u2');
            const t = await svc.createTodo('u1', { title: 'Shared task' });
            const toggled = await svc.toggleComplete(t.id, 'u2');
            expect(toggled.done).toBe(true);
        });

        it('lets a member update the title of a shared todo', async () => {
            friends.add('u1', 'u2');
            const t = await svc.createTodo('u1', { title: 'Shared task' });
            const updated = await svc.updateTodo(t.id, 'u2', { title: 'Renamed by member' });
            expect(updated.title).toBe('Renamed by member');
        });

        it("does not let a member change a shared todo's users[]", async () => {
            friends.add('u1', 'u2');
            const t = await svc.createTodo('u1', { title: 'Shared task' });
            const originalUsers = t.users;
            const updated = await svc.updateTodo(t.id, 'u2', { title: 'x', users: [] });
            expect(updated.users).toEqual(originalUsers);
        });

        it('rejects toggleComplete by a non-member non-owner with 403', async () => {
            friends.add('u1', 'u2');
            const t = await svc.createTodo('u1', { title: 'Shared task' });
            await expect(svc.toggleComplete(t.id, 'intruder')).rejects.toMatchObject({ status: 403 });
        });

        it('rejects updateTodo by a non-member non-owner with 403', async () => {
            friends.add('u1', 'u2');
            const t = await svc.createTodo('u1', { title: 'Shared task' });
            await expect(svc.updateTodo(t.id, 'intruder', { title: 'x' })).rejects.toMatchObject({ status: 403 });
        });

        it('rejects deleteTodo by a member with 403 (owner-only delete)', async () => {
            friends.add('u1', 'u2');
            const t = await svc.createTodo('u1', { title: 'Shared task' });
            await expect(svc.deleteTodo(t.id, 'u2')).rejects.toMatchObject({ status: 403 });
        });
    });
});
