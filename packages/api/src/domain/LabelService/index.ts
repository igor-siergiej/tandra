import type { Logger } from '@imapps/api-utils';
import type { Label } from '@tandra/types';
import type { IdGenerator } from '../IdGenerator';

import type { LabelRepository } from '../LabelRepository';
import type { TodoRepository } from '../TodoRepository';

export interface CreateLabelInput {
    name: string;
    color: string;
    id?: string;
}

export type UpdateLabelInput = Partial<Pick<Label, 'name' | 'color'>>;

const forbidden = () => Object.assign(new Error('Forbidden'), { status: 403 });
const notFound = () => Object.assign(new Error('Label not found'), { status: 404 });

export class LabelService {
    constructor(
        private readonly labels: LabelRepository,
        private readonly todos: TodoRepository,
        private readonly idGenerator: IdGenerator,
        private readonly logger?: Logger
    ) {}

    private async getOwned(labelId: string, ownerId: string): Promise<Label> {
        const label = await this.labels.getById(labelId);
        if (!label) throw notFound();
        if (label.ownerId !== ownerId) throw forbidden();
        return label;
    }

    async createLabel(ownerId: string, input: CreateLabelInput): Promise<Label> {
        if (input.id) {
            const existing = await this.labels.getById(input.id);
            if (existing && existing.ownerId === ownerId) {
                return existing; // idempotent replay
            }
        }
        const label: Label = {
            id: input.id ?? this.idGenerator.generate(),
            ownerId,
            name: input.name,
            color: input.color,
        };
        await this.labels.insert(label);
        return label;
    }

    async getLabelsByOwner(ownerId: string): Promise<Label[]> {
        return this.labels.findByOwnerId(ownerId);
    }

    async updateLabel(labelId: string, ownerId: string, input: UpdateLabelInput): Promise<Label> {
        const existing = await this.getOwned(labelId, ownerId);
        // Only the label's own fields come from the body; id and ownerId always stay as stored.
        return this.labels.update(labelId, {
            ...existing,
            ...(input.name !== undefined && { name: input.name }),
            ...(input.color !== undefined && { color: input.color }),
        });
    }

    async deleteLabel(labelId: string, ownerId: string): Promise<void> {
        await this.getOwned(labelId, ownerId);
        await this.labels.deleteById(labelId);
        await this.todos.clearLabel(labelId, ownerId);
        this.logger?.info('Label deleted and cleared from todos', { labelId, ownerId });
    }
}
