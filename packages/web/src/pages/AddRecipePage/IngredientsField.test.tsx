import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type Ingredient, IngredientsField } from './IngredientsField';

const Harness = ({ initialIngredients = new Array<Ingredient>() }) => {
    const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
    const [showIngredientsPaste, setShowIngredientsPaste] = useState(initialIngredients.length === 0);
    const [ingredientsPasteText, setIngredientsPasteText] = useState('');

    return (
        <IngredientsField
            ingredients={ingredients}
            ingredientsPasteText={ingredientsPasteText}
            setIngredientsPasteText={setIngredientsPasteText}
            showIngredientsPaste={showIngredientsPaste}
            setShowIngredientsPaste={setShowIngredientsPaste}
            onChange={setIngredients}
        />
    );
};

describe('IngredientsField', () => {
    it('starts in paste mode with no add-drawer trigger', () => {
        render(<Harness />);

        expect(screen.getByPlaceholderText(/Paste ingredients here/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /add ingredient/i })).not.toBeInTheDocument();
    });

    it('switches to one-at-a-time mode and shows an empty state plus the add trigger', async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await user.click(screen.getByRole('button', { name: /add one at a time/i }));

        expect(screen.queryByPlaceholderText(/Paste ingredients here/)).not.toBeInTheDocument();
        expect(screen.getByText(/no ingredients added yet/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add ingredient/i })).toBeInTheDocument();
    });

    it('adds an ingredient via the drawer', async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await user.click(screen.getByRole('button', { name: /add one at a time/i }));
        await user.click(screen.getByRole('button', { name: /add ingredient/i }));
        await user.type(screen.getByPlaceholderText('Enter ingredient name...'), 'Flour');
        await user.click(screen.getByRole('button', { name: 'Add Ingredient' }));

        expect(screen.getByText('Flour')).toBeInTheDocument();
        expect(screen.queryByText(/no ingredients added yet/i)).not.toBeInTheDocument();
    });

    it('edits an ingredient via the edit drawer', async () => {
        const user = userEvent.setup();
        render(<Harness initialIngredients={[{ name: 'Flour', quantity: 500, unit: 'g' }]} />);

        await user.click(screen.getByRole('button', { name: 'Edit Flour' }));
        const nameInput = screen.getByPlaceholderText('Enter ingredient name');
        await user.clear(nameInput);
        await user.type(nameInput, 'Plain Flour');
        await user.click(screen.getByRole('button', { name: 'Save Changes' }));

        expect(screen.getByText('Plain Flour')).toBeInTheDocument();
        expect(screen.queryByText('Flour')).not.toBeInTheDocument();
    });

    it('deletes an ingredient', async () => {
        const user = userEvent.setup();
        render(<Harness initialIngredients={[{ name: 'Flour' }]} />);

        await user.click(screen.getByRole('button', { name: 'Delete Flour' }));

        expect(screen.queryByText('Flour')).not.toBeInTheDocument();
        expect(screen.getByText(/no ingredients added yet/i)).toBeInTheDocument();
    });

    it('toggles back to paste mode', async () => {
        const user = userEvent.setup();
        render(<Harness initialIngredients={[{ name: 'Flour' }]} />);

        await user.click(screen.getByRole('button', { name: /edit text/i }));

        expect(screen.getByPlaceholderText(/Paste ingredients here/)).toBeInTheDocument();
    });
});
