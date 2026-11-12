import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { suggestIngredientSubstitutes } from '../../api';
import { IngredientSubstitutesPopover } from './index';

vi.mock('../../api', () => ({
    suggestIngredientSubstitutes: vi.fn(),
}));

const fetchMock = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
            imageGeneration: true,
            recipeImport: true,
            ingredientSubstitutes: true,
            itemCategorisation: true,
            itemParse: true,
            recipeTagger: true,
        }),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
    fetchMock.mockReset();
});

const mockSuggest = vi.mocked(suggestIngredientSubstitutes);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('IngredientSubstitutesPopover', () => {
    it('fetches and shows substitutes when opened', async () => {
        mockSuggest.mockResolvedValue({ substitutes: ['margarine', 'coconut oil'] });
        render(<IngredientSubstitutesPopover ingredientName="butter" recipeTitle="Carbonara" />);

        await userEvent.click(screen.getByLabelText('Suggest substitutes for butter'));

        expect(await screen.findByText('margarine')).toBeInTheDocument();
        expect(screen.getByText('coconut oil')).toBeInTheDocument();
        expect(mockSuggest).toHaveBeenCalledWith('butter', 'Carbonara');
    });

    it('shows a loading state while the request is in flight', async () => {
        const { promise, resolve: resolveRequest } = Promise.withResolvers<{ substitutes: string[] }>();
        mockSuggest.mockReturnValue(promise);
        render(<IngredientSubstitutesPopover ingredientName="butter" />);

        await userEvent.click(screen.getByLabelText('Suggest substitutes for butter'));

        expect(screen.getByText('Thinking…')).toBeInTheDocument();
        resolveRequest({ substitutes: [] });
        await waitFor(() => expect(screen.getByText('No substitutes found.')).toBeInTheDocument());
    });

    it('shows an error message when the request fails', async () => {
        mockSuggest.mockRejectedValue(new Error('Ingredient substitution is not configured'));
        render(<IngredientSubstitutesPopover ingredientName="butter" />);

        await userEvent.click(screen.getByLabelText('Suggest substitutes for butter'));

        expect(await screen.findByText('Ingredient substitution is not configured')).toBeInTheDocument();
    });

    it('only fetches once across repeated opens', async () => {
        mockSuggest.mockResolvedValue({ substitutes: ['margarine'] });
        render(<IngredientSubstitutesPopover ingredientName="butter" />);

        const trigger = screen.getByLabelText('Suggest substitutes for butter');
        await userEvent.click(trigger);
        await screen.findByText('margarine');
        await userEvent.click(trigger); // close
        await userEvent.click(trigger); // reopen

        expect(mockSuggest).toHaveBeenCalledTimes(1);
    });

    it('dismisses the popover when the user scrolls outside it', async () => {
        mockSuggest.mockResolvedValue({ substitutes: ['margarine'] });
        render(<IngredientSubstitutesPopover ingredientName="butter" />);

        const trigger = screen.getByLabelText('Suggest substitutes for butter');
        await userEvent.click(trigger);
        await screen.findByText('margarine');
        // A scroll event originating outside the popover content closes it.
        act(() => {
            window.dispatchEvent(new Event('scroll', { bubbles: true }));
        });

        await waitFor(() => {
            expect(screen.queryByText('margarine')).not.toBeInTheDocument();
        });
    });

    it('does not dismiss the popover when the user scrolls inside its content', async () => {
        mockSuggest.mockResolvedValue({ substitutes: ['margarine'] });
        render(<IngredientSubstitutesPopover ingredientName="butter" />);

        const trigger = screen.getByLabelText('Suggest substitutes for butter');
        await userEvent.click(trigger);
        await screen.findByText('margarine');

        // Find the popover content (portaled by Radix). Scrolling INSIDE it must not close.
        const popoverContent = document.querySelector('[data-radix-popper-content-wrapper]');
        expect(popoverContent).not.toBeNull();
        act(() => {
            popoverContent?.dispatchEvent(new Event('scroll', { bubbles: true }));
        });

        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, 50);
        await promise;
        expect(screen.queryByText('margarine')).toBeInTheDocument();
    });

    it('does not refetch on the dismiss-then-reopen cycle', async () => {
        mockSuggest.mockResolvedValue({ substitutes: ['margarine'] });
        render(<IngredientSubstitutesPopover ingredientName="butter" />);

        const trigger = screen.getByLabelText('Suggest substitutes for butter');
        await userEvent.click(trigger);
        await screen.findByText('margarine');

        // Scroll to dismiss.
        act(() => {
            window.dispatchEvent(new Event('scroll', { bubbles: true }));
        });
        await waitFor(() => {
            expect(screen.queryByText('margarine')).not.toBeInTheDocument();
        });

        // Reopen — cache should serve the same response without another fetch.
        await userEvent.click(trigger);
        expect(screen.getByText('margarine')).toBeInTheDocument();
        expect(mockSuggest).toHaveBeenCalledTimes(1);
    });
});
