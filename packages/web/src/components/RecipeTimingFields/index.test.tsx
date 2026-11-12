import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { RecipeTimingFields } from './index';

const baseProps = {
    prepTimeId: 'prep-time',
    cookTimeId: 'cook-time',
    servingsId: 'servings',
    difficultyId: 'difficulty',
    prepTime: '20',
    cookTime: '15',
    servings: '4',
    difficulty: 'easy' as const,
    onPrepTimeChange: vi.fn(),
    onCookTimeChange: vi.fn(),
    onServingsChange: vi.fn(),
    onDifficultyChange: vi.fn(),
};

describe('RecipeTimingFields', () => {
    it('renders prep time, cook time, servings and difficulty with their current values', () => {
        render(<RecipeTimingFields {...baseProps} />);

        expect(screen.getByLabelText('Prep time')).toHaveValue(20);
        expect(screen.getByLabelText('Cook time')).toHaveValue(15);
        expect(screen.getByLabelText('Servings')).toHaveValue(4);
        expect(screen.getByText('Easy')).toBeInTheDocument();
    });

    it('calls the matching onChange when a time field is edited', async () => {
        const onPrepTimeChange = vi.fn();
        render(<RecipeTimingFields {...baseProps} prepTime="" onPrepTimeChange={onPrepTimeChange} />);

        await userEvent.type(screen.getByLabelText('Prep time'), '5');

        expect(onPrepTimeChange).toHaveBeenLastCalledWith('5');
    });

    it('disables every field when disabled is set', () => {
        render(<RecipeTimingFields {...baseProps} disabled />);

        expect(screen.getByLabelText('Prep time')).toBeDisabled();
        expect(screen.getByLabelText('Cook time')).toBeDisabled();
        expect(screen.getByLabelText('Servings')).toBeDisabled();
    });
});
