import type { MongoDbConnection } from '@imapps/api-utils';
import type { Todo } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { TodoRepository } from '../../domain/TodoRepository';

export class MongoTodoRepository implements TodoRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.Todo);
    }

    // id for single lookups, ownerId/users.id for the per-user list, done+dueDate for the reminder scan.
    // Not unique: the create path does not rule out a repeated id in existing data.
    async ensureIndexes(): Promise<void> {
        await this.collection().createIndex({ id: 1 });
        await this.collection().createIndex({ ownerId: 1 });
        await this.collection().createIndex({ 'users.id': 1 });
        await this.collection().createIndex({ done: 1, dueDate: 1 });
    }

    async getById(todoId: string): Promise<Todo | null> {
        return this.collection().findOne({ id: todoId });
    }

    async findByOwnerId(ownerId: string): Promise<Todo[]> {
        return this.collection().find({ ownerId }).toArray();
    }

    async findDueCandidates(today: string): Promise<Todo[]> {
        // dueDate is a YYYY-MM-DD day string; ISO day strings sort lexically, so a plain
        // $lte against today's day matches today's and overdue todos (recurring anchors included).
        return this.collection()
            .find({ done: false, dueDate: { $lte: today } })
            .toArray();
    }

    async insert(todo: Todo): Promise<Todo> {
        await this.collection().insertOne(todo);

        return todo;
    }

    async update(todoId: string, todo: Todo): Promise<Todo> {
        await this.collection().findOneAndReplace({ id: todoId }, todo);
        const updated = await this.getById(todoId);

        if (!updated) {
            throw new Error('Todo not found');
        }

        return updated;
    }

    async deleteById(todoId: string): Promise<void> {
        await this.collection().deleteOne({ id: todoId });
    }

    async clearLabel(labelId: string, ownerId: string): Promise<void> {
        await this.collection().updateMany({ labelId, ownerId }, { $unset: { labelId: '' } });
    }

    async findByMember(userId: string): Promise<Todo[]> {
        return this.collection().find({ 'users.id': userId }).toArray();
    }

    async removeMemberFromAll(memberId: string, ownerId: string): Promise<void> {
        await this.collection().updateMany({ ownerId }, { $pull: { users: { id: memberId } } });
    }
}
