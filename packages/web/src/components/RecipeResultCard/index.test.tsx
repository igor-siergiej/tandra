import type { Recipe } from '@tandra/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { fake, present } from '../../testing/fake';
import { RecipeResultCard } from './index';

const recipe: Recipe = {
    id: 'r1',
    title: 'Pie',
    coverImageKey: 'recipe-upload/u1/r1/1.webp',
    ingredients: [],
    users: [],
    dateAdded: new Date(0),
};

describe('RecipeResultCard', () => {
    it('loads an uploaded cover through the image endpoint and shows it', async () => {
        const fetchMock = vi.fn(async () => new Response(new Blob(['img']), { status: 200 }));
        global.fetch = fake<typeof fetch>(fetchMock);
        URL.createObjectURL = vi.fn(() => 'blob:cover');
        URL.revokeObjectURL = vi.fn();

        render(<RecipeResultCard recipe={recipe} subtitle="2 ingredients" onClick={vi.fn()} />);

        expect(await screen.findByRole('img', { name: 'Pie' })).toHaveAttribute('src', 'blob:cover');
        expect(fetchMock).toHaveBeenCalledWith(
            `/api/image/${encodeURIComponent(present(recipe.coverImageKey, 'cover key'))}`
        );
    });
});
