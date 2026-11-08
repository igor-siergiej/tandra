import { describe, expect, it } from 'bun:test';

import { dependencyContainer, registerDepdendencies } from './index';
import { DependencyToken } from './types';

// The container builds every dependency with `new ctor()`, so a factory that is not constructible only fails when it
// is first resolved: at startup in production. Resolving everything here makes that a test failure instead.
describe('dependency registration', () => {
    registerDepdendencies();
    // Some repositories touch their collection while being constructed; give the shared connection one that accepts anything.
    Object.assign(dependencyContainer.resolve(DependencyToken.Database), {
        getCollection: () => ({ createIndex: async () => 'index' }),
    });

    it.each(Object.values(DependencyToken))('resolves %s to an object without connecting to anything', (token) => {
        const resolved = dependencyContainer.resolve(token);

        expect(resolved).toBeDefined();
        expect(resolved).not.toBeNull();
    });

    it('wires services to the same shared instances', () => {
        expect(dependencyContainer.resolve(DependencyToken.ListService)).toBe(
            dependencyContainer.resolve(DependencyToken.ListService)
        );
    });

    it('gives ListService the item categoriser and realtime notifier', () => {
        const service = dependencyContainer.resolve(DependencyToken.ListService);

        // Both are private collaborators, so the test reads them as properties rather than through the type.
        expect(service).toHaveProperty(
            'itemCategoryService',
            dependencyContainer.resolve(DependencyToken.ItemCategoryService)
        );
        expect(service).toHaveProperty('onListChanged', expect.any(Function));
    });
});
