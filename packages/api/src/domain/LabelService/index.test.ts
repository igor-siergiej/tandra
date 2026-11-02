import { beforeEach, describe, expect, it } from 'bun:test';

import type { Label } from '@tandra/types';

import { LabelService } from './index';

class MockLabelRepo {
    store = new Map<string, Label>();
    async insert(l: Label) {
        this.store.set(l.id, l);
        return l;
    }
    async getById(id: string) {
        return this.store.get(id) ?? null;
    }
    async findByOwnerId(ownerId: string) {
        return [...this.store.values()].filter((l) => l.ownerId === ownerId);
    }
    async update(id: string, l: Label) {
        this.store.set(id, l);
        return l;
    }
    async deleteById(id: string) {
        this.store.delete(id);
    }
}

class MockTodoRepo {
    cleared: Array<{ labelId: string; ownerId: string }> = [];
    async clearLabel(labelId: string, ownerId: string) {
        this.cleared.push({ labelId, ownerId });
    }
}

class MockIds {
    private n = 0;
    generate() {
        this.n += 1;
        return `L-${this.n}`;
    }
}

describe('LabelService', () => {
    let labels: MockLabelRepo;
    let todos: MockTodoRepo;
    let svc: LabelService;

    beforeEach(() => {
        labels = new MockLabelRepo();
        todos = new MockTodoRepo();
        svc = new LabelService(labels as never, todos as never, new MockIds() as never);
    });

    it('creates a label for the owner', async () => {
        const l = await svc.createLabel('u1', { name: 'Work', color: '#3b82f6' });
        expect(l).toMatchObject({ id: 'L-1', ownerId: 'u1', name: 'Work', color: '#3b82f6' });
    });

    it('lists labels for the owner only', async () => {
        await svc.createLabel('u1', { name: 'A', color: '#111' });
        await svc.createLabel('u2', { name: 'B', color: '#222' });
        expect(await svc.getLabelsByOwner('u1')).toHaveLength(1);
    });

    it('renames/recolours an owned label', async () => {
        const l = await svc.createLabel('u1', { name: 'A', color: '#111' });
        const updated = await svc.updateLabel(l.id, 'u1', { name: 'Home', color: '#22c55e' });
        expect(updated).toMatchObject({ name: 'Home', color: '#22c55e' });
    });

    it('rejects update by non-owner with 403', async () => {
        const l = await svc.createLabel('u1', { name: 'A', color: '#111' });
        expect(svc.updateLabel(l.id, 'intruder', { name: 'x' })).rejects.toMatchObject({ status: 403 });
    });

    it("deletes an owned label and clears it from the owner's todos", async () => {
        const l = await svc.createLabel('u1', { name: 'A', color: '#111' });
        await svc.deleteLabel(l.id, 'u1');
        expect(await labels.getById(l.id)).toBeNull();
        expect(todos.cleared).toEqual([{ labelId: l.id, ownerId: 'u1' }]);
    });

    it('rejects delete by non-owner with 403 and does not clear todos', async () => {
        const l = await svc.createLabel('u1', { name: 'A', color: '#111' });
        expect(svc.deleteLabel(l.id, 'intruder')).rejects.toMatchObject({ status: 403 });
        expect(todos.cleared).toEqual([]);
    });

    describe('createLabel idempotency', () => {
        it('uses the caller-provided id when given', async () => {
            const label = await svc.createLabel('user-1', { name: 'Home', color: '#fff', id: 'client-label-uuid' });
            expect(label.id).toBe('client-label-uuid');
        });

        it('returns the existing label without re-insert when id+owner already exist', async () => {
            const first = await svc.createLabel('user-1', { name: 'Home', color: '#fff', id: 'client-label-uuid' });
            const second = await svc.createLabel('user-1', { name: 'Work', color: '#000', id: 'client-label-uuid' });
            expect(second).toBe(first);
            expect(second.name).toBe('Home');
            expect(await svc.getLabelsByOwner('user-1')).toHaveLength(1);
        });
    });
});
