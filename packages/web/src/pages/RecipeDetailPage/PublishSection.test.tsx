import type { PublishedRecipeRef, Recipe } from '@tandra/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import * as api from '../../api';
import { PublishSection } from './PublishSection';

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'r1',
    title: 'Grandma Soup',
    ingredients: [{ id: 'i1', name: 'carrot' }],
    instructions: ['Chop.'],
    ownerId: 'user-1',
    users: [{ id: 'user-1', username: 'me' }],
    dateAdded: new Date(),
    ...overrides,
});

const published = (): PublishedRecipeRef => ({ recipeId: 'r1', libraryId: 'user-9', publishedAt: new Date(0) });

const renderSection = (r: Recipe, mine: PublishedRecipeRef[] = []) => {
    vi.spyOn(api, 'getPublishedRecipesQuery').mockReturnValue({
        queryKey: ['discover-published'],
        queryFn: async () => mine,
    } as never);

    return render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <PublishSection recipe={r} />
        </QueryClientProvider>
    );
};

describe('PublishSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('offers "Make public" for a recipe that is not public yet', async () => {
        renderSection(recipe());

        expect(await screen.findByRole('button', { name: 'Make public' })).toBeInTheDocument();
        expect(screen.queryByText('Public')).not.toBeInTheDocument();
    });

    it('shows the Public indicator with Update and Unpublish for a published recipe', async () => {
        renderSection(recipe(), [published()]);

        expect(await screen.findByText('Public')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update public copy' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Make public' })).not.toBeInTheDocument();
    });

    it.each([
        ['imported from a link', { link: 'https://example.com/soup' }],
        ['copied from Discover', { attribution: '"Soup" from Wikibooks Cookbook, CC BY-SA 4.0' }],
    ])('explains instead of offering to publish a recipe %s', async (_label, overrides) => {
        renderSection(recipe(overrides));

        expect(await screen.findByText(/can't be made public/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Make public' })).not.toBeInTheDocument();
    });

    describe('licence step', () => {
        const openDrawer = async () => {
            await userEvent.click(await screen.findByRole('button', { name: 'Make public' }));

            return screen.findByRole('dialog');
        };

        it('states the licence and cannot be submitted until the user agrees', async () => {
            const publish = vi.spyOn(api, 'publishRecipe').mockResolvedValue(published());
            renderSection(recipe());

            const dialog = await openDrawer();

            expect(within(dialog).getAllByText(/CC BY-SA 4\.0/).length).toBeGreaterThan(0);
            const submit = within(dialog).getByRole('button', { name: 'Make public' });
            expect(submit).toBeDisabled();
            await userEvent.click(submit);
            expect(publish).not.toHaveBeenCalled();
        });

        it('publishes with the agreement, and does not show the name unless asked', async () => {
            const publish = vi.spyOn(api, 'publishRecipe').mockResolvedValue(published());
            renderSection(recipe());
            const dialog = await openDrawer();

            const showName = within(dialog).getByRole('checkbox', { name: /Show my username/ });
            expect(showName).not.toBeChecked();
            await userEvent.click(within(dialog).getByRole('checkbox', { name: /I wrote this recipe myself/ }));
            await userEvent.click(within(dialog).getByRole('button', { name: 'Make public' }));

            await waitFor(() => expect(publish).toHaveBeenCalledWith('r1', { agreeToLicence: true, showName: false }));
        });

        it('sends the opt-in to show the username when ticked', async () => {
            const publish = vi.spyOn(api, 'publishRecipe').mockResolvedValue(published());
            renderSection(recipe());
            const dialog = await openDrawer();

            await userEvent.click(within(dialog).getByRole('checkbox', { name: /I wrote this recipe myself/ }));
            await userEvent.click(within(dialog).getByRole('checkbox', { name: /Show my username/ }));
            await userEvent.click(within(dialog).getByRole('button', { name: 'Make public' }));

            await waitFor(() => expect(publish).toHaveBeenCalledWith('r1', { agreeToLicence: true, showName: true }));
        });

        it("shows the server's reason when publishing is refused, and stays open to try again", async () => {
            vi.spyOn(api, 'publishRecipe').mockRejectedValue(
                Object.assign(new Error('A recipe like this is already in the library'), { status: 409 })
            );
            renderSection(recipe());
            const dialog = await openDrawer();

            await userEvent.click(within(dialog).getByRole('checkbox', { name: /I wrote this recipe myself/ }));
            await userEvent.click(within(dialog).getByRole('button', { name: 'Make public' }));

            expect(await within(dialog).findByRole('alert')).toHaveTextContent('already in the library');
            expect(within(dialog).getByRole('button', { name: 'Make public' })).toBeEnabled();
        });
    });

    it('unpublishes only after confirmation', async () => {
        const unpublish = vi.spyOn(api, 'unpublishRecipe').mockResolvedValue(undefined);
        renderSection(recipe(), [published()]);

        await userEvent.click(await screen.findByRole('button', { name: 'Unpublish' }));
        const dialog = await screen.findByRole('alertdialog');
        expect(unpublish).not.toHaveBeenCalled();

        await userEvent.click(within(dialog).getByRole('button', { name: 'Unpublish' }));

        await waitFor(() => expect(unpublish).toHaveBeenCalledWith('user-9'));
    });

    it('does not unpublish when the confirmation is cancelled', async () => {
        const unpublish = vi.spyOn(api, 'unpublishRecipe').mockResolvedValue(undefined);
        renderSection(recipe(), [published()]);

        await userEvent.click(await screen.findByRole('button', { name: 'Unpublish' }));
        await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

        expect(unpublish).not.toHaveBeenCalled();
    });
});
