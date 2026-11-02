import type { RecipeImportResult } from '@tandra/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateRecipeAiImage, importRecipe, importRecipeImage, uploadRecipeImage } from '../../api';
import AddRecipePage from './index';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../auth', () => ({
    useUser: () => ({ user: { id: 'user-1', username: 'testuser' } }),
}));

vi.mock('../../hooks/useFriends', () => ({
    useFriends: vi.fn(() => ({ friends: [], isLoading: false })),
}));

vi.mock('../../contexts/UnitSystemContext', () => ({
    useUnitSystem: () => ({ unitSystem: 'original', setUnitSystem: vi.fn() }),
}));

vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

const mockCreateRecipe = vi.fn();
vi.mock('../../hooks/useRecipeMutations', () => ({
    useRecipeMutations: () => ({
        createRecipe: mockCreateRecipe,
    }),
}));

let mockRecipesData: Array<{ id: string; title: string; ingredients: unknown[] }> = [];

vi.mock('../../api', () => ({
    importRecipe: vi.fn(),
    importRecipeImage: vi.fn(),
    uploadRecipeImage: vi.fn(),
    generateRecipeAiImage: vi.fn().mockResolvedValue(undefined),
    getRecipesQuery: vi.fn(() => ({ queryKey: ['recipes', 'user-1'], queryFn: async () => mockRecipesData })),
    getRecipeQuery: vi.fn((recipeId: string) => ({ queryKey: ['recipe', recipeId], queryFn: async () => undefined })),
    getListsQuery: vi.fn(() => ({ queryKey: ['lists', 'user-1'], queryFn: async () => [] })),
}));

const renderPage = (initialEntry = '/recipes/new') => {
    const queryClient = new QueryClient();
    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/recipes/new" element={<AddRecipePage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
    return { ...result, queryClient };
};

// Bare renderPage() now lands on the choice screen; these helpers navigate into the
// mode a given test actually needs before its assertions/interactions run.
const enterManualMode = async () => {
    await userEvent.click(screen.getByRole('button', { name: /add manually/i }));
};

const enterImportMode = async () => {
    await userEvent.click(screen.getByRole('button', { name: /import from a link/i }));
};

describe('AddRecipePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateRecipe.mockResolvedValue('recipe-1');
        mockRecipesData = [];
    });

    it('disables Create Recipe until a title is entered', async () => {
        renderPage();
        await enterManualMode();
        expect(screen.getByRole('button', { name: /create recipe/i })).toBeDisabled();

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'X');
        expect(screen.getByRole('button', { name: /create recipe/i })).not.toBeDisabled();
    });

    it('navigates back to /recipes when the footer Cancel button is pressed', async () => {
        renderPage();
        await enterManualMode();
        const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
        await userEvent.click(cancelButtons[cancelButtons.length - 1]);
        expect(mockNavigate).toHaveBeenCalledWith('/recipes');
    });

    it('renders recipe title input', async () => {
        renderPage();
        await enterManualMode();
        expect(screen.getByPlaceholderText('Enter recipe title...')).toBeTruthy();
    });

    it('gives every text field explicit autofill-safe attributes so mobile keyboards do not show a payment/address autosuggest bar', async () => {
        renderPage();
        await enterManualMode();

        const titleInput = screen.getByPlaceholderText('Enter recipe title...');
        expect(titleInput).toHaveAttribute('autocomplete', 'off');
        expect(titleInput).toHaveAttribute('name', 'recipe-title');
        expect(titleInput).toHaveAttribute('inputmode', 'text');
        // type="search" keeps Chrome Android from offering address/credit-card autofill
        // (autoComplete="off" is not enough on type="text" inputs).
        expect(titleInput).toHaveAttribute('type', 'search');

        const linkInput = screen.getByPlaceholderText('https://...');
        expect(linkInput).toHaveAttribute('autocomplete', 'off');
        expect(linkInput).toHaveAttribute('name', 'recipe-link');
        expect(linkInput).toHaveAttribute('inputmode', 'url');

        const ingredientsTextarea = screen.getByPlaceholderText(/Paste ingredients here/);
        expect(ingredientsTextarea).toHaveAttribute('autocomplete', 'off');
        expect(ingredientsTextarea).toHaveAttribute('name', 'recipe-ingredients');
        expect(ingredientsTextarea).toHaveAttribute('inputmode', 'text');

        const instructionsTextarea = screen.getByPlaceholderText(/Paste instructions here/);
        expect(instructionsTextarea).toHaveAttribute('autocomplete', 'off');
        expect(instructionsTextarea).toHaveAttribute('name', 'recipe-instructions');
        expect(instructionsTextarea).toHaveAttribute('inputmode', 'text');

        const tagInput = screen.getByPlaceholderText('Add a tag and press Enter...');

        expect(tagInput).toHaveAttribute('autocomplete', 'off');

        expect(tagInput).toHaveAttribute('inputmode', 'text');
        expect(tagInput).toHaveAttribute('type', 'search');
    });
    it('groups fields into labeled sections', async () => {
        renderPage();
        await enterManualMode();

        for (const heading of ['Photo', 'Basics', 'Ingredients', 'Instructions', 'Tags', 'Share']) {
            expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
        }
    });

    it('displays image upload area', async () => {
        renderPage();
        await enterManualMode();
        expect(screen.getByText('Click to upload image')).toBeTruthy();
    });

    it('auto-generates image when no image is uploaded', async () => {
        renderPage();
        await enterManualMode();

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'Test Recipe');
        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(generateRecipeAiImage).toHaveBeenCalledWith('recipe-1');
        });
    });

    it('does not call generateRecipeAiImage when an image was uploaded', async () => {
        renderPage();
        await enterManualMode();

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'Another Recipe');
        const imageFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [imageFile] } });

        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(uploadRecipeImage).toHaveBeenCalledWith('recipe-1', imageFile);
        });
        expect(generateRecipeAiImage).not.toHaveBeenCalled();
    });

    it('handles image upload by passing file to uploadRecipeImage', async () => {
        renderPage();
        await enterManualMode();

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'Another Recipe');
        const imageFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [imageFile] } });

        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(uploadRecipeImage).toHaveBeenCalledWith('recipe-1', imageFile);
        });
    });

    it('typing into the manual link field does not trigger import', async () => {
        renderPage();
        await enterManualMode();
        await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com/recipe');
        expect(importRecipe).not.toHaveBeenCalled();
    });

    it('pasting into the manual link field does not trigger import', async () => {
        renderPage();
        await enterManualMode();
        const linkInput = screen.getByPlaceholderText('https://...');
        await userEvent.click(linkInput);
        await userEvent.paste('https://example.com/recipe');
        expect(importRecipe).not.toHaveBeenCalled();
    });

    it('renders recipe link input', async () => {
        renderPage();
        await enterManualMode();
        expect(screen.getByPlaceholderText('https://...')).toBeTruthy();
    });

    it('pre-fills link and auto-imports when sharedUrl search param is present, skipping choice and import screens', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Shared Dish',
            ingredients: [],
            instructions: [],
            link: 'https://example.com/recipe',
        });

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Frecipe');

        const input = screen.getByPlaceholderText('https://...') as HTMLInputElement;
        expect(input.value).toBe('https://example.com/recipe');
        expect(screen.getByPlaceholderText('Enter recipe title...')).toBeTruthy();
        expect(screen.getByRole('button', { name: /create recipe/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /add manually/i })).toBeFalsy();
        expect(screen.queryByRole('button', { name: /or add manually instead/i })).toBeFalsy();

        await waitFor(() => {
            expect(importRecipe).toHaveBeenCalledWith('https://example.com/recipe', expect.any(AbortSignal));
        });

        expect(screen.queryByRole('button', { name: /add manually/i })).toBeFalsy();
        expect(screen.queryByRole('button', { name: /or add manually instead/i })).toBeFalsy();
    });

    it('renders instructions paste textarea', async () => {
        renderPage();
        await enterManualMode();
        expect(screen.getByPlaceholderText(/Paste instructions here/)).toBeTruthy();
    });

    it('splits pasted text into steps on blur', async () => {
        renderPage();
        await enterManualMode();
        const textarea = screen.getByPlaceholderText(/Paste instructions here/) as HTMLTextAreaElement;
        await userEvent.type(textarea, 'Step one{enter}Step two{enter}Step three');
        fireEvent.blur(textarea);
        await waitFor(() => {
            expect(screen.getByText('Step one')).toBeTruthy();
            expect(screen.getByText('Step two')).toBeTruthy();
            expect(screen.getByText('Step three')).toBeTruthy();
        });
    });

    it('disables the instructions textarea while an import is in flight', async () => {
        vi.mocked(importRecipe).mockImplementation(() => new Promise(() => {}));
        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Frecipe');

        const textarea = screen.getByPlaceholderText(/Paste instructions here/) as HTMLTextAreaElement;
        await waitFor(() => {
            expect(textarea.disabled).toBe(true);
        });
    });

    it('lets the user cancel an in-flight import', async () => {
        let capturedSignal: AbortSignal | undefined;
        vi.mocked(importRecipe).mockImplementation(
            (_url: string, signal?: AbortSignal) =>
                new Promise((_resolve, reject) => {
                    capturedSignal = signal;
                    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                })
        );

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fslow');

        const cancelButton = await screen.findByRole('button', { name: /Cancel import/ });
        await userEvent.click(cancelButton);

        await waitFor(() => {
            expect(capturedSignal?.aborted).toBe(true);
            expect(screen.queryByRole('button', { name: /Cancel import/ })).toBeFalsy();
        });
        expect(screen.queryByText('Aborted')).toBeFalsy();
    });

    it('walks the in-flight import through the page-fetch stage and then the cover-photo stage', async () => {
        const draft = Promise.withResolvers<RecipeImportResult>();
        const neverSettlingImage = Promise.withResolvers<File>();
        vi.mocked(importRecipe).mockReturnValue(draft.promise);
        vi.mocked(importRecipeImage).mockReturnValue(neverSettlingImage.promise);

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fstaged');

        const fetchStep = await screen.findByText('Reading the recipe page');
        const imageStep = screen.getByText('Fetching the cover photo');
        expect(fetchStep.closest('li')).toHaveAttribute('aria-current', 'step');
        expect(imageStep.closest('li')).not.toHaveAttribute('aria-current');

        draft.resolve({
            title: 'Staged',
            ingredients: [],
            instructions: ['Mix.'],
            link: 'https://example.com/staged',
            image: 'https://example.com/cover.jpg',
        });

        await waitFor(() => {
            expect(screen.getByText('Fetching the cover photo').closest('li')).toHaveAttribute('aria-current', 'step');
        });
        expect(screen.getByText('Reading the recipe page').closest('li')).not.toHaveAttribute('aria-current');
    });

    it('cancelling during the cover-photo leg aborts that request too', async () => {
        let imageSignal: AbortSignal | undefined;
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Half Imported',
            ingredients: [],
            instructions: ['Mix.'],
            link: 'https://example.com/slow-image',
            image: 'https://example.com/cover.jpg',
        });
        vi.mocked(importRecipeImage).mockImplementation((_url: string, signal?: AbortSignal) => {
            const image = Promise.withResolvers<File>();
            imageSignal = signal;
            signal?.addEventListener('abort', () => image.reject(new DOMException('Aborted', 'AbortError')));
            return image.promise;
        });

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fslow-image');

        await waitFor(() => {
            expect(imageSignal).toBeDefined();
        });

        await userEvent.click(screen.getByRole('button', { name: /Cancel import/ }));

        await waitFor(() => {
            expect(imageSignal?.aborted).toBe(true);
            expect(screen.queryByRole('button', { name: /Cancel import/ })).toBeFalsy();
        });
        expect(screen.queryByText('Reading the recipe page')).toBeFalsy();
        expect(screen.queryByText('Aborted')).toBeFalsy();
    });

    it('auto-attaches the scraped cover image after a successful import', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Imported With Image',
            ingredients: [{ id: 'i1', name: 'flour' }],
            instructions: ['Mix.'],
            link: 'https://example.com/dish',
            image: 'https://example.com/cover.jpg',
        });
        const imageFile = new File(['bytes'], 'imported-cover.jpg', { type: 'image/jpeg' });
        vi.mocked(importRecipeImage).mockResolvedValue(imageFile);

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fdish');

        await waitFor(() => {
            expect(importRecipeImage).toHaveBeenCalledWith('https://example.com/cover.jpg', expect.any(AbortSignal));
        });

        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(uploadRecipeImage).toHaveBeenCalledWith('recipe-1', imageFile);
        });
    });

    it('does not block the import when the cover image proxy fails', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Imported No Image',
            ingredients: [],
            instructions: ['Mix.'],
            link: 'https://example.com/dish2',
            image: 'https://example.com/cover2.jpg',
        });
        vi.mocked(importRecipeImage).mockRejectedValue(new Error('proxy failed'));

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fdish2');

        await waitFor(() => {
            expect(screen.getByText('Mix.')).toBeTruthy();
        });
        expect(screen.queryByText('proxy failed')).toBeFalsy();
    });

    it('does not autofocus the title field after a completed share-target import', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Imported Dish',
            ingredients: [],
            instructions: ['Mix.'],
            link: 'https://example.com/dish3',
        });

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fdish3');

        const titleInput = await screen.findByPlaceholderText('Enter recipe title...');
        await waitFor(() => {
            expect((titleInput as HTMLInputElement).value).toBe('Imported Dish');
        });
        expect(titleInput).not.toHaveFocus();
    });

    it('prefills prep time, cook time and servings from a scraped import', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Timed Dish',
            ingredients: [],
            instructions: ['Mix.'],
            link: 'https://example.com/timed',
            prepTime: 'PT10M',
            cookTime: 'PT25M',
            recipeYield: '4 servings',
        });

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Ftimed');

        await waitFor(() => {
            expect(screen.getByLabelText('Prep time')).toHaveValue(10);
            expect(screen.getByLabelText('Cook time')).toHaveValue(25);
            expect(screen.getByLabelText('Servings')).toHaveValue(4);
        });
    });

    it('leaves prep time, cook time and servings empty on a fresh manual entry', async () => {
        renderPage();
        await enterManualMode();
        expect(screen.getByLabelText('Prep time')).toHaveValue(null);
        expect(screen.getByLabelText('Cook time')).toHaveValue(null);
        expect(screen.getByLabelText('Servings')).toHaveValue(null);
    });

    it('navigates to /recipes after successful recipe creation', async () => {
        renderPage();
        await enterManualMode();
        mockCreateRecipe.mockImplementation(async () => {
            mockRecipesData = [{ id: 'recipe-1', title: 'Pizza Margherita', ingredients: [] }];
            return 'recipe-1';
        });

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'Pizza Margherita');
        await userEvent.click(screen.getByRole('button', { name: /create recipe/i }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/recipes'));
    });

    it('passes link and instructions to createRecipe', async () => {
        renderPage();
        await enterManualMode();
        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'My Recipe');
        await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com');

        const textarea = screen.getByPlaceholderText(/Paste instructions here/) as HTMLTextAreaElement;
        await userEvent.type(textarea, 'Step one{enter}Step two');
        fireEvent.blur(textarea);

        await waitFor(() => {
            expect(screen.getByText('Step one')).toBeTruthy();
        });

        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(mockCreateRecipe).toHaveBeenCalledWith(
                'My Recipe',
                [],
                [],
                'https://example.com',
                ['Step one', 'Step two'],
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            );
        });
    });

    it('preserves quantity/unit parsed from an imported recipe when creating it', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Imported Dish',
            ingredients: [
                { id: 'i1', name: 'flour', quantity: 200, unit: 'g' },
                { id: 'i2', name: 'eggs', quantity: 3 },
                { id: 'i3', name: 'salt' },
            ],
            instructions: ['Mix.', 'Bake.'],
            link: 'https://example.com/dish',
        });

        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fdish');

        await waitFor(() => {
            expect(screen.getByText('flour')).toBeTruthy();
            expect(screen.getByText('200 g')).toBeTruthy();
            expect(screen.getByText('eggs')).toBeTruthy();
            expect(screen.getByText('3')).toBeTruthy();
            expect(screen.getByText('salt')).toBeTruthy();
        });

        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(mockCreateRecipe).toHaveBeenCalledWith(
                'Imported Dish',
                [],
                [
                    { name: 'flour', quantity: 200, unit: 'g' },
                    { name: 'eggs', quantity: 3, unit: undefined },
                    { name: 'salt', quantity: undefined, unit: undefined },
                ],
                'https://example.com/dish',
                ['Mix.', 'Bake.'],
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            );
        });
    });

    it('renders the choice screen by default with no sharedUrl param', () => {
        renderPage();
        expect(screen.getByRole('button', { name: /import from a link/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /add manually/i })).toBeTruthy();
        expect(screen.queryByPlaceholderText('Enter recipe title...')).toBeFalsy();
    });

    it('clicking Import from a link shows the import screen', async () => {
        renderPage();
        await enterImportMode();
        expect(screen.getByPlaceholderText('https://...')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Import recipe from link/i })).toBeTruthy();
        expect(screen.queryByPlaceholderText('Enter recipe title...')).toBeFalsy();
    });

    it('clicking Add manually shows the full form, empty, and autofocuses the title field', async () => {
        renderPage();
        await enterManualMode();
        const titleInput = screen.getByPlaceholderText('Enter recipe title...') as HTMLInputElement;
        expect(titleInput.value).toBe('');
        expect(titleInput).toHaveFocus();
    });

    it('navigates to /recipes when the choice screen Cancel button is pressed', async () => {
        renderPage();
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(mockNavigate).toHaveBeenCalledWith('/recipes');
    });

    it('a successful import via the choice→import path transitions to a pre-filled form', async () => {
        vi.mocked(importRecipe).mockResolvedValue({
            title: 'Imported Dish',
            ingredients: [{ id: 'i1', name: 'flour', quantity: 200, unit: 'g' }],
            instructions: ['Mix.', 'Bake.'],
            link: 'https://example.com/dish',
        });

        renderPage();
        await enterImportMode();

        await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com/dish');
        await userEvent.click(screen.getByRole('button', { name: /Import/ }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter recipe title...')).toBeTruthy();
        });
        expect((screen.getByPlaceholderText('Enter recipe title...') as HTMLInputElement).value).toBe('Imported Dish');
        expect(screen.getByText('flour')).toBeTruthy();
        expect(screen.getByText('200 g')).toBeTruthy();
        expect(screen.getByText('Mix.')).toBeTruthy();
    });

    it('on import failure, shows an inline error with Retry and Switch to manual on the import screen', async () => {
        vi.mocked(importRecipe).mockRejectedValueOnce(new Error('This site blocks automated requests'));
        renderPage();
        await enterImportMode();

        await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com/blocked');
        await userEvent.click(screen.getByRole('button', { name: /Import/ }));

        await waitFor(() => {
            expect(screen.getByText('This site blocks automated requests')).toBeTruthy();
        });
        expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Switch to manual/ })).toBeTruthy();
        expect(screen.queryByPlaceholderText('Enter recipe title...')).toBeFalsy();
    });

    it('clicking Retry after a failure succeeds and transitions to form', async () => {
        vi.mocked(importRecipe).mockRejectedValueOnce(new Error('This site blocks automated requests'));
        renderPage();
        await enterImportMode();

        await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com/blocked');
        await userEvent.click(screen.getByRole('button', { name: /Import/ }));

        await waitFor(() => {
            expect(screen.getByText('This site blocks automated requests')).toBeTruthy();
        });

        vi.mocked(importRecipe).mockResolvedValueOnce({
            title: 'Recovered',
            ingredients: [],
            instructions: [],
            link: 'https://example.com/blocked',
        });

        await userEvent.click(screen.getByRole('button', { name: /Retry/ }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter recipe title...')).toBeTruthy();
        });
        expect((screen.getByPlaceholderText('Enter recipe title...') as HTMLInputElement).value).toBe('Recovered');
    });

    it('clicking Switch to manual after a failure moves to form with the link retained and everything else empty', async () => {
        vi.mocked(importRecipe).mockRejectedValueOnce(new Error('This site blocks automated requests'));
        renderPage();
        await enterImportMode();

        await userEvent.type(screen.getByPlaceholderText('https://...'), 'https://example.com/blocked');
        await userEvent.click(screen.getByRole('button', { name: /Import/ }));

        await waitFor(() => {
            expect(screen.getByText('This site blocks automated requests')).toBeTruthy();
        });

        await userEvent.click(screen.getByRole('button', { name: /Switch to manual/ }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter recipe title...')).toBeTruthy();
        });
        expect((screen.getByPlaceholderText('Enter recipe title...') as HTMLInputElement).value).toBe('');
        expect((screen.getByPlaceholderText('https://...') as HTMLInputElement).value).toBe(
            'https://example.com/blocked'
        );
        expect(screen.queryByText('This site blocks automated requests')).toBeFalsy();
    });

    it('shows a persistent error banner with a Retry action when import fails in form mode', async () => {
        vi.mocked(importRecipe).mockRejectedValueOnce(new Error('This site blocks automated requests'));
        renderPage('/recipes/new?sharedUrl=https%3A%2F%2Fexample.com%2Fblocked');

        await waitFor(() => {
            expect(screen.getByText('This site blocks automated requests')).toBeTruthy();
        });
        expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();

        vi.mocked(importRecipe).mockResolvedValueOnce({
            title: 'Recovered',
            ingredients: [],
            instructions: [],
            link: 'https://example.com/blocked',
        });

        await userEvent.click(screen.getByRole('button', { name: /Retry/ }));

        await waitFor(() => {
            expect(screen.queryByText('This site blocks automated requests')).toBeFalsy();
        });
        expect((screen.getByPlaceholderText('Enter recipe title...') as HTMLInputElement).value).toBe('Recovered');
    });

    it('clicking "or add manually instead" with no error moves straight to an empty, focused form', async () => {
        renderPage();
        await enterImportMode();

        await userEvent.click(screen.getByRole('button', { name: /or add manually instead/i }));

        const titleInput = screen.getByPlaceholderText('Enter recipe title...') as HTMLInputElement;
        expect(titleInput.value).toBe('');
        expect(titleInput).toHaveFocus();
    });

    it('invalidates the single-recipe query cache after uploading an image', async () => {
        vi.mocked(uploadRecipeImage).mockResolvedValue({ imageKey: 'recipe-upload/u1/recipe-1/1.jpg' });
        const { queryClient } = renderPage();
        await enterManualMode();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'Another Recipe');
        const imageFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [imageFile] } });
        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recipe', 'recipe-1'] });
        });
    });

    it('writes the AI-generated recipe straight into the single-recipe query cache', async () => {
        const aiGenerated = { id: 'recipe-1', title: 'Test Recipe', coverImageKey: 'recipe-image/recipe-1/ai.jpg' };
        vi.mocked(generateRecipeAiImage).mockResolvedValue(aiGenerated as never);
        const { queryClient } = renderPage();
        await enterManualMode();

        await userEvent.type(screen.getByPlaceholderText('Enter recipe title...'), 'Test Recipe');
        await userEvent.click(screen.getByRole('button', { name: /Create Recipe/ }));

        await waitFor(() => {
            expect(queryClient.getQueryData(['recipe', 'recipe-1'])).toEqual(aiGenerated);
        });
    });
});
