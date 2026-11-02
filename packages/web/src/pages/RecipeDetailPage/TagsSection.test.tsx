import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TagsSection } from './TagsSection';

describe('TagsSection', () => {
    it('renders nothing when there are no tags and not editing', () => {
        const { container } = render(<TagsSection tags={[]} isOwner isEditing={false} onChange={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows read-only chips when not editing', () => {
        render(<TagsSection tags={['dinner', 'quick']} isOwner isEditing={false} onChange={vi.fn()} />);
        expect(screen.getByText('dinner')).toBeInTheDocument();
        expect(screen.getByText('quick')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Remove tag/)).not.toBeInTheDocument();
    });

    it('renders nothing for a non-owner while the page is in edit mode', () => {
        const { container } = render(<TagsSection tags={[]} isOwner={false} isEditing onChange={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the add/remove editor for the owner while editing', async () => {
        const onChange = vi.fn();
        render(<TagsSection tags={['dinner']} isOwner isEditing onChange={onChange} />);

        expect(screen.getByText('dinner')).toBeInTheDocument();
        await userEvent.type(screen.getByPlaceholderText(/Add a tag/i), 'quick{Enter}');

        expect(onChange).toHaveBeenCalledWith(['dinner', 'quick']);
    });

    it('removes a tag via the editor', async () => {
        const onChange = vi.fn();
        render(<TagsSection tags={['dinner', 'quick']} isOwner isEditing onChange={onChange} />);

        await userEvent.click(screen.getByLabelText('Remove tag dinner'));

        expect(onChange).toHaveBeenCalledWith(['quick']);
    });
});
