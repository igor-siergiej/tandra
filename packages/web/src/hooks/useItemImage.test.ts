import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useItemImage } from './useItemImage';

// Mock fetch globally
global.fetch = vi.fn();

describe('useItemImage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with null blob URL and no error', () => {
        const { result } = renderHook(() => useItemImage('test-item'));

        expect(result.current.imageBlobUrl).toBeNull();
        expect(result.current.hasImageError).toBe(false);
        expect(result.current.hasLoadedImage).toBe(false);
    });

    it('fetches image on mount with correct item name', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });
        vi.mocked(global.fetch).mockResolvedValueOnce(new Response(mockBlob));

        renderHook(() => useItemImage('apple'));

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/image/apple'));
        });
    });

    it('does not fetch when the item name is null', () => {
        // The effect calls fetch synchronously when it runs, so no wait is needed to observe it.
        const { result } = renderHook(() => useItemImage(null));

        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.current.hasImageError).toBe(false);
    });

    it('creates object URL from blob response', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });
        vi.mocked(global.fetch).mockResolvedValueOnce(new Response(mockBlob));

        const { result } = renderHook(() => useItemImage('test-item'));

        await waitFor(() => {
            expect(result.current.imageBlobUrl).toBeTruthy();
        });
    });

    it('sets error when response is not ok', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

        const { result } = renderHook(() => useItemImage('nonexistent'));

        await waitFor(() => {
            expect(result.current.hasImageError).toBe(true);
        });
    });

    it('sets error on network failure', async () => {
        vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useItemImage('test-item'));

        await waitFor(() => {
            expect(result.current.hasImageError).toBe(true);
        });
    });

    it('provides onImageLoad callback', () => {
        const { result } = renderHook(() => useItemImage('test-item'));

        expect(result.current.onImageLoad).toEqual(expect.any(Function));
    });

    it('provides onImageError callback', () => {
        const { result } = renderHook(() => useItemImage('test-item'));

        expect(result.current.onImageError).toEqual(expect.any(Function));
    });

    it('cleans up blob URL on unmount', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });
        vi.mocked(global.fetch).mockResolvedValueOnce(new Response(mockBlob));

        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

        const { unmount } = renderHook(() => useItemImage('test-item'));

        await waitFor(() => {
            expect(revokeObjectURLSpy).not.toHaveBeenCalled();
        });

        unmount();

        await waitFor(() => {
            expect(revokeObjectURLSpy).toHaveBeenCalled();
        });
    });

    it('refetches when item name changes', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });
        vi.mocked(global.fetch).mockResolvedValue(new Response(mockBlob));

        const { rerender } = renderHook(({ name }: { name: string }) => useItemImage(name), {
            initialProps: { name: 'apple' },
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/image/apple'));
        });

        rerender({ name: 'banana' });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/image/banana'));
        });
    });
});
