import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

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
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            blob: vi.fn().mockResolvedValueOnce(mockBlob),
        });

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
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            blob: vi.fn().mockResolvedValueOnce(mockBlob),
        });

        const { result } = renderHook(() => useItemImage('test-item'));

        await waitFor(() => {
            expect(result.current.imageBlobUrl).toBeTruthy();
        });
    });

    it('sets error when response is not ok', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        const { result } = renderHook(() => useItemImage('nonexistent'));

        await waitFor(() => {
            expect(result.current.hasImageError).toBe(true);
        });
    });

    it('sets error on network failure', async () => {
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useItemImage('test-item'));

        await waitFor(() => {
            expect(result.current.hasImageError).toBe(true);
        });
    });

    it('provides onImageLoad callback', () => {
        const { result } = renderHook(() => useItemImage('test-item'));

        expect(typeof result.current.onImageLoad).toBe('function');
    });

    it('provides onImageError callback', () => {
        const { result } = renderHook(() => useItemImage('test-item'));

        expect(typeof result.current.onImageError).toBe('function');
    });

    it('cleans up blob URL on unmount', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/png' });
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            blob: vi.fn().mockResolvedValueOnce(mockBlob),
        });

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
        (global.fetch as any).mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(mockBlob),
        });

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
