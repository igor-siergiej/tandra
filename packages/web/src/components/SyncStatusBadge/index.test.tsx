import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const count = { value: 0 };
const isOnline = { value: true };

vi.mock('../../hooks/useOutboxCount', () => ({ useOutboxCount: () => count.value }));

vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => isOnline.value }));

import { SyncStatusBadge } from './index';

describe('SyncStatusBadge', () => {
    it('renders nothing when no pending changes', () => {
        count.value = 0;
        isOnline.value = true;
        const { container } = render(<SyncStatusBadge />);
        expect(container).toBeEmptyDOMElement();
    });
    it('shows the pending count', () => {
        count.value = 3;
        isOnline.value = true;
        render(<SyncStatusBadge />);
        expect(screen.getByText(/3 pending/i)).toBeInTheDocument();
    });
    it('shows Offline when offline', () => {
        count.value = 0;
        isOnline.value = false;
        render(<SyncStatusBadge />);
        expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });
});
