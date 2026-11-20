import type { Todo } from '@tandra/types';

export interface TodoRepository {
    ensureIndexes(): Promise<void>;
    getById(todoId: string): Promise<Todo | null>;
    findByOwnerId(ownerId: string): Promise<Todo[]>;
    /** Incomplete todos whose dueDate day is on or before `today` (YYYY-MM-DD) — recurring anchors included. */
    findDueCandidates(today: string): Promise<Todo[]>;
    insert(todo: Todo): Promise<Todo>;
    /** Replaces only while membership matches `previous` (or `todo` for content-only edits); otherwise throws 409. */
    update(todoId: string, todo: Todo, previous?: Todo): Promise<Todo>;
    deleteById(todoId: string): Promise<void>;
    clearLabel(labelId: string, ownerId: string): Promise<void>;
    /** Todos where userId appears in users[] (shared with them). */
    findByMember(userId: string): Promise<Todo[]>;
    /** Remove memberId from users[] on every todo owned by ownerId. */
    removeMemberFromAll(memberId: string, ownerId: string): Promise<void>;
    deleteOwnedBy(userId: string): Promise<void>;
    /** Removes the user from `users[]` on every todo, whoever owns it. */
    removeMemberEverywhere(memberId: string): Promise<void>;
}
