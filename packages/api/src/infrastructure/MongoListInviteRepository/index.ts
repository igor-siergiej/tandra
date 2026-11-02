import type { MongoDbConnection } from '@imapps/api-utils';
import type { ListInvite } from '@tandra/types';

import { CollectionNames, type Collections } from '../../dependencies/types';
import type { ListInviteRepository } from '../../domain/ListInviteRepository';

const NO_OBJECT_ID = { projection: { _id: 0 } } as const;

export class MongoListInviteRepository implements ListInviteRepository {
    constructor(private readonly db: MongoDbConnection<Collections>) {}

    private collection() {
        return this.db.getCollection(CollectionNames.ListInvite);
    }

    // fallow-ignore-next-line unused-class-member
    async ensureIndexes(): Promise<void> {
        // token is the document id (string), so it has a unique index by default.
        // The owner index makes the "list invites I've issued" query fast and the
        // expiresAt index is the cleanup sweep.
        await this.collection().createIndex({ ownerId: 1, createdAt: -1 });
        await this.collection().createIndex({ expiresAt: 1 });
    }

    // fallow-ignore-next-line unused-class-member
    async insert(invite: ListInvite): Promise<void> {
        await this.collection().insertOne({ _id: invite.token, ...invite });
    }

    // fallow-ignore-next-line unused-class-member
    async getByToken(token: string): Promise<ListInvite | null> {
        return this.collection().findOne({ _id: token }, NO_OBJECT_ID);
    }

    // fallow-ignore-next-line unused-class-member
    async markClaimed(token: string, userId: string, at: Date): Promise<ListInvite | null> {
        const result = await this.collection().findOneAndUpdate(
            { _id: token, claimedAt: { $exists: false } },
            { $set: { claimedBy: userId, claimedAt: at } },
            { returnDocument: 'after' }
        );

        // SAFETY: `Collections` is a union of every collection's document type, so the update result cannot infer ListInvite; this collection only holds ListInvite documents.
        return (result ?? null) as ListInvite | null;
    }

    // fallow-ignore-next-line unused-class-member
    async markRevoked(token: string, at: Date): Promise<void> {
        await this.collection().updateOne({ _id: token, revokedAt: { $exists: false } }, { $set: { revokedAt: at } });
    }

    // fallow-ignore-next-line unused-class-member
    async listOpenByOwner(ownerId: string, now: Date): Promise<ListInvite[]> {
        // SAFETY: `Collections` is a union of every collection's document type, so find() cannot infer ListInvite; this collection only holds ListInvite documents and the projection drops nothing the type declares.
        return this.collection()
            .find(
                {
                    ownerId,
                    revokedAt: { $exists: false },
                    claimedAt: { $exists: false },
                    expiresAt: { $gt: now },
                },
                NO_OBJECT_ID
            )
            .sort({ createdAt: -1 })
            .toArray() as Promise<ListInvite[]>;
    }
}
