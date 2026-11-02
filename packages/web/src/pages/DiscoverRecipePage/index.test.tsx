import type { DiscoveryRecipe, PublishedRecipeRef, Recipe } from '@tandra/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../api';
import DiscoverRecipePage from './index';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../auth', () => ({ useUser: () => ({ user: { id: 'user-1', username: 'me' } }) }));
vi.mock('../../components/ToolBar', () => ({ default: () => <div data-testid="toolbar" /> }));

const SOURCE_URL = 'https://en.wikibooks.org/wiki/Cookbook:Fairy_Cakes';

const library: DiscoveryRecipe = {
    id: 'wikibooks-1',
    title: 'Fairy Cakes',
    ingredients: [
        { id: 'i1', name: 'butter', quantity: 100, unit: 'g' },
        { id: 'i2', name: 'eggs', quantity: 2, unit: 'pcs' },
        { id: 'i3', name: 'jam' },
    ],
    instructions: ['Cream the butter.', 'Bake for 20 minutes.'],
    tags: ['cake', 'dessert'],
    prepTime: 15,
    cookTime: 20,
    servings: 12,
    difficulty: 'easy',
    source: 'wikibooks',
    sourceUrl: SOURCE_URL,
    licence: 'CC-BY-SA-4.0',
    attribution: '"Fairy Cakes" from Wikibooks Cookbook, CC BY-SA 4.0',
    estimated: ['prepTime', 'servings'],
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const personal = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'mine-1',
    title: 'Fairy Cakes',
    ingredients: [],
    users: [{ id: 'user-1', username: 'me' }],
    dateAdded: new Date(),
    ...overrides,
});

const setup = ({
    recipe = library,
    mine = [] as Recipe[],
    similar = [] as Array<Record<string, unknown>>,
    published = [] as PublishedRecipeRef[],
    copy = vi.fn(async () => personal({ id: 'new-1', link: SOURCE_URL })),
}: {
    recipe?: DiscoveryRecipe | Error;
    mine?: Recipe[];
    similar?: Array<Record<string, unknown>>;
    published?: PublishedRecipeRef[];
    copy?: ReturnType<typeof vi.fn>;
} = {}) => {
    vi.spyOn(api, 'getDiscoveryRecipeQuery').mockReturnValue({
        queryKey: ['discover-recipe', 'wikibooks-1'],
        queryFn: async () => {
            if (recipe instanceof Error) throw recipe;
            return recipe;
        },
    } as never);
    vi.spyOn(api, 'getSimilarDiscoveryRecipesQuery').mockReturnValue({
        queryKey: ['discover-similar', 'wikibooks-1'],
        queryFn: async () => similar,
    } as never);
    vi.spyOn(api, 'getRecipesQuery').mockReturnValue({
        queryKey: ['recipes', 'user-1'],
        queryFn: async () => mine,
    } as never);
    vi.spyOn(api, 'getPublishedRecipesQuery').mockReturnValue({
        queryKey: ['discover-published'],
        queryFn: async () => published,
    } as never);
    vi.spyOn(api, 'copyDiscoveryRecipe').mockImplementation(copy as never);

    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={['/discover/wikibooks-1']}>
                <Routes>
                    <Route path="/discover/:recipeId" element={<DiscoverRecipePage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
    return { copy };
};

describe('DiscoverRecipePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('previews the recipe: ingredients, steps and meta', async () => {
        setup();

        expect(await screen.findByRole('heading', { name: 'Fairy Cakes' })).toBeInTheDocument();
        expect(screen.getByText('100 g butter')).toBeInTheDocument();
        // A bare count reads "2 eggs", not "2 pcs eggs"; a name with no measurement stands alone.
        expect(screen.getByText('2 eggs')).toBeInTheDocument();
        expect(screen.getByText('jam')).toBeInTheDocument();
        expect(screen.getByText('Cream the butter.')).toBeInTheDocument();
        expect(screen.getByText('20m cook')).toBeInTheDocument();
        expect(screen.getByText('Easy')).toBeInTheDocument();
    });

    it('visibly marks estimated values and explains the mark, but not values read from the source', async () => {
        setup();

        await screen.findByRole('heading', { name: 'Fairy Cakes' });
        expect(screen.getByText('≈15m prep')).toBeInTheDocument();
        expect(screen.getByText('≈12 servings')).toBeInTheDocument();
        expect(screen.queryByText('≈20m cook')).not.toBeInTheDocument();
        expect(screen.getByText(/estimated, not stated in the original recipe/)).toBeInTheDocument();
    });

    it('shows no estimate legend when everything came from the source', async () => {
        setup({ recipe: { ...library, estimated: undefined } });

        await screen.findByRole('heading', { name: 'Fairy Cakes' });
        expect(screen.queryByText(/estimated, not stated/)).not.toBeInTheDocument();
    });

    it('shows the attribution and licence, and links to the source page safely', async () => {
        setup();

        const source = await screen.findByRole('region', { name: 'Source' });
        expect(within(source).getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
        expect(within(source).getByText('Licence: CC-BY-SA-4.0')).toBeInTheDocument();
        const link = within(source).getByRole('link', { name: /View the original recipe/ });
        expect(link).toHaveAttribute('href', SOURCE_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('shows a similar-recipes strip and opens a similar recipe', async () => {
        setup({
            similar: [{ id: 'wikibooks-9', title: 'Butterfly Cakes', tags: [], source: 'wikibooks', cookTime: 18 }],
        });

        const strip = await screen.findByRole('region', { name: 'Similar recipes' });
        await userEvent.click(within(strip).getByRole('button', { name: /Butterfly Cakes/ }));

        expect(mockNavigate).toHaveBeenCalledWith('/discover/wikibooks-9');
    });

    it('omits the similar strip when there is nothing similar', async () => {
        setup({ similar: [] });

        await screen.findByRole('heading', { name: 'Fairy Cakes' });
        expect(screen.queryByRole('region', { name: 'Similar recipes' })).not.toBeInTheDocument();
    });

    it('adds the recipe in one tap and then shows it as added, with a way to open it', async () => {
        const { copy } = setup();

        await userEvent.click(await screen.findByRole('button', { name: 'Add to my recipes' }));

        expect(copy).toHaveBeenCalledWith('wikibooks-1');
        expect(await screen.findByRole('button', { name: 'Added to your recipes' })).toBeDisabled();
        expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/recipes/new-1');
    });

    it("does not offer to add a recipe that is already among the user's recipes", async () => {
        const { copy } = setup({ mine: [personal({ id: 'mine-7', link: SOURCE_URL })] });

        const button = await screen.findByRole('button', { name: 'Already in your recipes' });

        expect(button).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Add to my recipes' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/recipes/mine-7');
        expect(copy).not.toHaveBeenCalled();
    });

    it('does not mistake an unrelated recipe for a copy', async () => {
        setup({ mine: [personal({ link: 'https://example.com/other' }), personal({ id: 'mine-2', link: undefined })] });

        expect(await screen.findByRole('button', { name: 'Add to my recipes' })).toBeEnabled();
    });

    it('stops a second tap while the first add is still in flight', async () => {
        let finish: (recipe: Recipe) => void = () => {};
        const copy = vi.fn(
            () =>
                new Promise<Recipe>((resolve) => {
                    finish = resolve;
                })
        );
        setup({ copy });

        await userEvent.click(await screen.findByRole('button', { name: 'Add to my recipes' }));

        expect(await screen.findByRole('button', { name: 'Adding...' })).toBeDisabled();
        finish(personal({ id: 'new-1', link: SOURCE_URL }));
        await screen.findByRole('button', { name: 'Added to your recipes' });
        expect(copy).toHaveBeenCalledTimes(1);
    });

    it('reports a failed add and lets the user try again', async () => {
        const copy = vi
            .fn()
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce(personal({ id: 'new-1', link: SOURCE_URL }));
        setup({ copy });

        await userEvent.click(await screen.findByRole('button', { name: 'Add to my recipes' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not add this recipe');

        await userEvent.click(screen.getByRole('button', { name: 'Add to my recipes' }));
        await screen.findByRole('button', { name: 'Added to your recipes' });
    });

    it('says so plainly when the recipe is no longer in the library', async () => {
        setup({ recipe: Object.assign(new Error('Library recipe not found'), { status: 404 }) });

        expect(await screen.findByRole('alert')).toHaveTextContent('Recipe not found');
        expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('goes back to the Discover list', async () => {
        setup();

        await userEvent.click(await screen.findByRole('button', { name: 'Discover' }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/discover'));
    });

    describe('user-published recipes', () => {
        const userRecipe: DiscoveryRecipe = {
            ...library,
            id: 'user-1',
            source: 'user',
            sourceUrl: '/discover/user-1',
            publishedBy: 'alice',
            attribution: '"Fairy Cakes" by alice, CC BY-SA 4.0',
            estimated: undefined,
        };

        it('says who shared it and links to no outside source, because this page is the source', async () => {
            setup({ recipe: userRecipe });

            expect(await screen.findByText('Shared by alice')).toBeInTheDocument();
            const source = screen.getByRole('region', { name: 'Source' });
            expect(within(source).getByText(/by alice, CC BY-SA 4.0/)).toBeInTheDocument();
            expect(within(source).queryByRole('link')).not.toBeInTheDocument();
        });

        it('shows no author line when the publisher did not opt in', async () => {
            setup({ recipe: { ...userRecipe, publishedBy: undefined } });

            await screen.findByRole('heading', { name: 'Fairy Cakes' });
            expect(screen.queryByText(/Shared by/)).not.toBeInTheDocument();
        });

        it('lets anyone else report it, with an optional reason', async () => {
            const report = vi.spyOn(api, 'reportDiscoveryRecipe').mockResolvedValue(undefined);
            setup({ recipe: userRecipe });

            await userEvent.click(await screen.findByRole('button', { name: 'Report' }));
            const dialog = await screen.findByRole('alertdialog');
            await userEvent.type(within(dialog).getByLabelText('Reason for the report'), 'copied from a blog');
            await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

            await waitFor(() => expect(report).toHaveBeenCalledWith('user-1', 'copied from a blog'));
            expect(await screen.findByText(/we'll take a look/)).toBeInTheDocument();
        });

        it('sends a report without a reason as undefined, not an empty string', async () => {
            const report = vi.spyOn(api, 'reportDiscoveryRecipe').mockResolvedValue(undefined);
            setup({ recipe: userRecipe });

            await userEvent.click(await screen.findByRole('button', { name: 'Report' }));
            await userEvent.click(
                within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Send report' })
            );

            await waitFor(() => expect(report).toHaveBeenCalledWith('user-1', undefined));
        });

        it('gives the publisher Unpublish instead of Report, and goes back to Discover afterwards', async () => {
            const unpublish = vi.spyOn(api, 'unpublishRecipe').mockResolvedValue(undefined);
            setup({
                recipe: userRecipe,
                published: [{ recipeId: 'gone-private-recipe', libraryId: 'user-1', publishedAt: new Date(0) }],
            });

            expect(await screen.findByText('Your public recipe')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
            await userEvent.click(
                within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Unpublish' })
            );

            await waitFor(() => expect(unpublish).toHaveBeenCalledWith('user-1'));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/discover'));
        });

        it("does not treat somebody else's publication as the viewer's own", async () => {
            setup({
                recipe: userRecipe,
                published: [{ recipeId: 'r', libraryId: 'user-77', publishedAt: new Date(0) }],
            });

            expect(await screen.findByRole('button', { name: 'Report' })).toBeInTheDocument();
            expect(screen.queryByText('Your public recipe')).not.toBeInTheDocument();
        });
    });

    describe('cover picture credit', () => {
        const withCover: DiscoveryRecipe = {
            ...library,
            coverImageKey: 'discovery-image/wikibooks-1/1.jpg',
            coverImageAttribution: 'Photo: Jane Doe, CC BY 2.0, via Wikimedia Commons',
            coverImageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Fairy_Cakes.jpg',
        };

        it("credits the picture with its licence, linking to the picture's own page", async () => {
            setup({ recipe: withCover });

            const credit = await screen.findByRole('link', { name: /Photo: Jane Doe, CC BY 2\.0/ });
            expect(credit).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Fairy_Cakes.jpg');
            expect(credit).toHaveAttribute('target', '_blank');
            expect(credit).toHaveAttribute('rel', expect.stringContaining('noopener'));
        });

        it('shows no picture credit for a recipe without a cover', async () => {
            setup();

            await screen.findByRole('heading', { name: 'Fairy Cakes' });
            expect(screen.queryByText(/^Photo:/)).not.toBeInTheDocument();
        });

        it('shows no credit when the credit is there but the picture is not', async () => {
            setup({ recipe: { ...withCover, coverImageKey: undefined } });

            await screen.findByRole('heading', { name: 'Fairy Cakes' });
            expect(screen.queryByText(/Photo: Jane Doe/)).not.toBeInTheDocument();
        });
    });

    it('still links to the original for Wikibooks recipes', async () => {
        setup();

        const source = await screen.findByRole('region', { name: 'Source' });
        expect(within(source).getByRole('link', { name: /View the original recipe/ })).toBeInTheDocument();
    });
});
