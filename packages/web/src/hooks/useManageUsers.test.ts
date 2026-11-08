import { describe, expect, it } from 'vitest';

describe('useManageUsers', () => {
    it('exports a hook function', async () => {
        const { useManageUsers } = await import('./useManageUsers');
        expect(useManageUsers).toEqual(expect.any(Function));
    });
});
