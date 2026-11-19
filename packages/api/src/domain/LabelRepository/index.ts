import type { Label } from '@tandra/types';

export interface LabelRepository {
    ensureIndexes(): Promise<void>;
    getById(labelId: string): Promise<Label | null>;
    findByOwnerId(ownerId: string): Promise<Label[]>;
    insert(label: Label): Promise<Label>;
    update(labelId: string, label: Label): Promise<Label>;
    deleteById(labelId: string): Promise<void>;
    deleteOwnedBy(userId: string): Promise<void>;
}
