import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InstructionsSection } from './InstructionsSection';

describe('InstructionsSection', () => {
    it('shows a placeholder when there are no instructions and not editing', () => {
        render(<InstructionsSection instructions={[]} isOwner isEditing={false} onChange={vi.fn()} />);
        expect(screen.getByText('No instructions added yet.')).toBeInTheDocument();
    });

    it('lists each instruction step when not editing', () => {
        render(
            <InstructionsSection
                instructions={['Boil water', 'Cook pasta']}
                isOwner
                isEditing={false}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText('Boil water')).toBeInTheDocument();
        expect(screen.getByText('Cook pasta')).toBeInTheDocument();
    });

    it('renders nothing for a non-owner while the page is in edit mode', () => {
        const { container } = render(
            <InstructionsSection instructions={[]} isOwner={false} isEditing onChange={vi.fn()} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('parses pasted text into steps and reports them via onChange', async () => {
        const onChange = vi.fn();
        render(<InstructionsSection instructions={[]} isOwner isEditing onChange={onChange} />);

        await userEvent.click(screen.getByRole('button', { name: /paste text/ }));
        const textarea = screen.getByPlaceholderText(/Paste instructions here/);
        await userEvent.type(textarea, 'Boil water\nCook pasta');
        await userEvent.tab();

        expect(onChange).toHaveBeenCalledWith(['Boil water', 'Cook pasta']);
    });
});
