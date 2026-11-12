import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { recordInAppNavigation, resetNavigationDepthForTests } from '../utils/navigationHistory';

const { mockNavigate } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

import { useGoBack } from './useGoBack';

describe('useGoBack', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        resetNavigationDepthForTests();
    });

    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

    it('navigates back (-1) when in-app history exists', () => {
        recordInAppNavigation(); // initial load
        recordInAppNavigation(); // one SPA navigation deeper

        const { result } = renderHook(() => useGoBack('/'), { wrapper });
        act(() => {
            result.current();
        });

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('falls back to the given path (replace) when there is no in-app history', () => {
        recordInAppNavigation(); // only the initial page load — e.g. a deep link

        const { result } = renderHook(() => useGoBack('/recipes'), { wrapper });
        act(() => {
            result.current();
        });

        expect(mockNavigate).toHaveBeenCalledWith('/recipes', { replace: true });
    });

    it('falls back when nothing has been recorded at all', () => {
        const { result } = renderHook(() => useGoBack('/'), { wrapper });
        act(() => {
            result.current();
        });

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
});
