import type { Logger } from '@imapps/api-utils';
import type { Recurrence, Todo, User } from '@tandra/types';

import type { FriendService } from '../FriendService';
import type { IdGenerator } from '../IdGenerator';
import type { NotificationService } from '../NotificationService';
import { resolveFriendMembers } from '../SharedMembers';
import type { TodoRepository } from '../TodoRepository';

export interface CreateTodoInput {
    title: string;
    dueDate?: string;
    time?: string;
    labelId?: string;
    recurrence?: Recurrence;
    id?: string;
    userIds?: string[];
}

export type ClearableTodoField = 'dueDate' | 'time' | 'labelId' | 'recurrence';

export type UpdateTodoInput = Partial<Omit<Todo, 'id' | 'ownerId' | 'dateAdded'>> & { clear?: ClearableTodoField[] };

const forbidden = () => Object.assign(new Error('Forbidden'), { status: 403 });
const notFound = () => Object.assign(new Error('Todo not found'), { status: 404 });

/**
 * dueDate/recurrence.until are timezone-agnostic YYYY-MM-DD days. Clients send that directly,
 * but a legacy client (or a Date serialized to ISO) may send a full instant — keep only the
 * day part so day-string range queries and calendar bucketing stay tz-stable.
 */
const toDay = (value: string): string => value.slice(0, 10);

const normalizeDays = <T extends { dueDate?: string; recurrence?: Recurrence }>(input: T): T => ({
    ...input,
    ...(input.dueDate !== undefined && { dueDate: toDay(input.dueDate) }),
    ...(input.recurrence?.until !== undefined && {
        recurrence: { ...input.recurrence, until: toDay(input.recurrence.until) },
    }),
});

export class TodoService {
    constructor(
        private readonly repo: TodoRepository,
        private readonly idGenerator: IdGenerator,
        private readonly logger?: Logger,
        private readonly friendService?: FriendService,
        private readonly notificationService?: NotificationService
    ) {}

    private async getOwned(todoId: string, ownerId: string): Promise<Todo> {
        const todo = await this.repo.getById(todoId);

        if (!todo) throw notFound();

        if (todo.ownerId !== ownerId) throw forbidden();

        return todo;
    }

    /** Owner or a shared member may load the todo; used where shared todos are collaborative (edit/complete). */
    private async getOwnedOrMember(todoId: string, actorId: string): Promise<Todo> {
        const todo = await this.repo.getById(todoId);

        if (!todo) throw notFound();

        if (todo.ownerId !== actorId && !todo.users?.some((u) => u.id === actorId)) throw forbidden();

        return todo;
    }

    async createTodo(ownerId: string, rawInput: CreateTodoInput, actor?: User): Promise<Todo> {
        const input = normalizeDays(rawInput);

        if (input.id) {
            const existing = await this.repo.getById(input.id);

            if (existing && existing.ownerId === ownerId) {
                return existing;
            }
        }

        const users = await resolveFriendMembers(this.friendService, ownerId, input.userIds);

        const todo: Todo = {
            id: input.id ?? this.idGenerator.generate(),
            ownerId,
            title: input.title,
            done: false,
            dateAdded: new Date(),
            ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
            ...(input.time !== undefined && { time: input.time }),
            ...(input.labelId !== undefined && { labelId: input.labelId }),
            ...(input.recurrence !== undefined && { recurrence: input.recurrence, completedDates: [] }),
            ...(users.length > 0 && { users }),
        };

        await this.repo.insert(todo);
        this.logger?.info('Todo created', { todoId: todo.id, ownerId });

        if (actor && todo.users && todo.users.length > 0) {
            void this.notificationService?.notifyTodoShared(todo, actor);
        }

        return todo;
    }

    async getTodosByOwner(ownerId: string): Promise<Todo[]> {
        return this.repo.findByOwnerId(ownerId);
    }

    async getTodosForUser(userId: string): Promise<Todo[]> {
        const owned = await this.repo.findByOwnerId(userId);
        const shared = await this.repo.findByMember(userId);
        const byId = new Map<string, Todo>();

        for (const t of [...owned, ...shared]) byId.set(t.id, t);

        return [...byId.values()];
    }

    async updateTodo(todoId: string, actorId: string, rawInput: UpdateTodoInput, actor?: User): Promise<Todo> {
        const existing = await this.getOwnedOrMember(todoId, actorId);
        const { clear, ...input } = normalizeDays(rawInput);

        // Membership (sharing) is owner-only; a member editing content must not re-scope who it's shared with.
        if (existing.ownerId !== actorId) delete input.users;
        const merged: Todo = { ...existing, ...input };

        for (const field of clear ?? []) delete merged[field];
        const updated = await this.repo.update(todoId, merged);

        if (actor && input.users) {
            const previousIds = new Set((existing.users ?? []).map((u) => u.id));
            const newlyAdded = input.users.filter((u) => !previousIds.has(u.id));

            if (newlyAdded.length > 0) {
                void this.notificationService?.notifyTodoShared({ ...updated, users: newlyAdded }, actor);
            }
        }

        return updated;
    }

    async deleteTodo(todoId: string, ownerId: string): Promise<void> {
        await this.getOwned(todoId, ownerId);
        await this.repo.deleteById(todoId);
    }

    async toggleComplete(todoId: string, actorId: string, date?: string): Promise<Todo> {
        const todo = await this.getOwnedOrMember(todoId, actorId);

        if (todo.recurrence && date) {
            const current = todo.completedDates ?? [];
            const completedDates = current.includes(date) ? current.filter((d) => d !== date) : [...current, date];

            return this.repo.update(todoId, { ...todo, completedDates });
        }

        return this.repo.update(todoId, { ...todo, done: !todo.done });
    }
}
