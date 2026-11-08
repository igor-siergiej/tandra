import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyError, notifySuccess, notifyWarning } from './toast';

vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

describe('toast helpers', () => {
    beforeEach(() => {
        vi.mocked(toast).mockReset();
        vi.mocked(toast.success).mockReset();
        vi.mocked(toast.error).mockReset();
    });

    it('notifySuccess forwards the message with a green style', () => {
        notifySuccess('Saved');

        expect(toast.success).toHaveBeenCalledWith('Saved', {
            style: { backgroundColor: '#10b981', color: '#ffffff', border: 'none' },
        });
    });

    it('notifyError forwards the message with a red style', () => {
        notifyError('Nope');

        expect(toast.error).toHaveBeenCalledWith('Nope', {
            style: { backgroundColor: '#ef4444', color: '#ffffff', border: 'none' },
        });
    });

    it('notifyWarning forwards the message with an amber style', () => {
        notifyWarning('Careful');

        expect(toast).toHaveBeenCalledWith('Careful', {
            style: { backgroundColor: '#f59e0b', color: '#ffffff', border: 'none' },
        });
    });
});
