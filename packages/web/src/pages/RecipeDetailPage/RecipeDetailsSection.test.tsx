import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecipeDetailsSection } from './RecipeDetailsSection';

const noopHandlers = {
    onEditedPrepTimeChange: vi.fn(),
    onEditedCookTimeChange: vi.fn(),
    onEditedServingsChange: vi.fn(),
    onEditedDifficultyChange: vi.fn(),
};

describe('RecipeDetailsSection', () => {
    it('renders nothing when nothing is set and not editing', () => {
        const { container } = render(
            <RecipeDetailsSection
                isOwner
                isEditing={false}
                editedPrepTime=""
                editedCookTime=""
                editedServings=""
                editedDifficulty=""
                {...noopHandlers}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows chips for whichever fields are set', () => {
        render(
            <RecipeDetailsSection
                prepTime={20}
                cookTime={15}
                servings={4}
                difficulty="easy"
                isOwner={false}
                isEditing={false}
                editedPrepTime=""
                editedCookTime=""
                editedServings=""
                editedDifficulty=""
                {...noopHandlers}
            />
        );
        expect(screen.getByText('Prep: 20 min')).toBeInTheDocument();
        expect(screen.getByText('Cook: 15 min')).toBeInTheDocument();
        expect(screen.getByText('Servings: 4')).toBeInTheDocument();
        expect(screen.getByText('Difficulty: Easy')).toBeInTheDocument();
    });

    it('renders nothing for a non-owner while the page is in edit mode', () => {
        const { container } = render(
            <RecipeDetailsSection
                isOwner={false}
                isEditing
                editedPrepTime=""
                editedCookTime=""
                editedServings=""
                editedDifficulty=""
                {...noopHandlers}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the timing fields prefilled with edited values for the owner while editing', () => {
        render(
            <RecipeDetailsSection
                isOwner
                isEditing
                editedPrepTime="20"
                editedCookTime="15"
                editedServings="4"
                editedDifficulty="hard"
                {...noopHandlers}
            />
        );
        expect(screen.getByLabelText('Prep time')).toHaveValue(20);
        expect(screen.getByLabelText('Cook time')).toHaveValue(15);
        expect(screen.getByLabelText('Servings')).toHaveValue(4);
    });

    it('reports edits via onEditedPrepTimeChange as the owner types', async () => {
        const onEditedPrepTimeChange = vi.fn();
        render(
            <RecipeDetailsSection
                isOwner
                isEditing
                editedPrepTime=""
                editedCookTime=""
                editedServings=""
                editedDifficulty=""
                {...noopHandlers}
                onEditedPrepTimeChange={onEditedPrepTimeChange}
            />
        );

        await userEvent.type(screen.getByLabelText('Prep time'), '5');

        expect(onEditedPrepTimeChange).toHaveBeenLastCalledWith('5');
    });
});
