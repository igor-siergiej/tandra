import type { Recipe } from '@tandra/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fake } from '../../testing/fake';

const revertRecipeAiImage = vi.fn();
const uploadRecipeImage = vi.fn();

vi.mock('../../api', () => ({
    revertRecipeAiImage: (...args: unknown[]) => revertRecipeAiImage(...args),
    uploadRecipeImage: (...args: unknown[]) => uploadRecipeImage(...args),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CoverImageSection } from './CoverImageSection';

const baseRecipe: Recipe = {
    id: 'recipe-1',
    title: 'Test',
    ingredients: [],
    users: [{ id: 'user-1', username: 'u' }],
    dateAdded: new Date(),
};

describe('CoverImageSection revert control', () => {
    beforeEach(() => {
        revertRecipeAiImage.mockReset().mockResolvedValue(baseRecipe);
        global.fetch = fake<typeof fetch>(vi.fn().mockResolvedValue({ ok: false }));
    });

    it('shows "Use AI image" when cover differs from the ai image', async () => {
        render(
            <CoverImageSection
                recipe={{
                    ...baseRecipe,
                    coverImageKey: 'recipe-upload/u/recipe-1/1',
                    aiImageKey: 'recipe-image/recipe-1',
                }}
                isOwner
                isEditing
            />
        );
        await waitFor(() => expect(screen.getByText('Use AI image')).toBeInTheDocument());
    });

    it('hides "Use AI image" when cover already is the ai image', async () => {
        render(
            <CoverImageSection
                recipe={{ ...baseRecipe, coverImageKey: 'recipe-image/recipe-1', aiImageKey: 'recipe-image/recipe-1' }}
                isOwner
                isEditing
            />
        );
        await waitFor(() => expect(screen.getByText('Replace')).toBeInTheDocument());
        expect(screen.queryByText('Use AI image')).not.toBeInTheDocument();
    });

    it('hides owner controls for non-owners', () => {
        render(
            <CoverImageSection
                recipe={{ ...baseRecipe, aiImageKey: 'recipe-image/recipe-1' }}
                isOwner={false}
                isEditing
            />
        );
        expect(screen.queryByText('Use AI image')).not.toBeInTheDocument();
        expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });

    it('hides owner controls when the page is not in edit mode', () => {
        render(
            <CoverImageSection
                recipe={{ ...baseRecipe, aiImageKey: 'recipe-image/recipe-1' }}
                isOwner
                isEditing={false}
            />
        );
        expect(screen.queryByText('Use AI image')).not.toBeInTheDocument();
        expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });

    it('calls revertRecipeAiImage and onImageChange on click', async () => {
        const onImageChange = vi.fn();
        const user = userEvent.setup();
        render(
            <CoverImageSection
                recipe={{
                    ...baseRecipe,
                    coverImageKey: 'recipe-upload/u/recipe-1/1',
                    aiImageKey: 'recipe-image/recipe-1',
                }}
                isOwner
                isEditing
                onImageChange={onImageChange}
            />
        );
        await user.click(await screen.findByText('Use AI image'));
        await waitFor(() => expect(revertRecipeAiImage).toHaveBeenCalledWith('recipe-1'));
        expect(onImageChange).toHaveBeenCalled();
    });
});
