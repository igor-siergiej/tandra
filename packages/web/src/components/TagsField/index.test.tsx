import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vite-plus/test';

import { TagsField } from './index';

describe('TagsField', () => {
    it('commits a tag on Enter and clears the input', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TagsField tags={[]} onChange={onChange} />);

        await user.type(screen.getByPlaceholderText(/add a tag/i), 'dinner{Enter}');

        expect(onChange).toHaveBeenCalledWith(['dinner']);
    });

    it('commits a tag on comma', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TagsField tags={[]} onChange={onChange} />);

        await user.type(screen.getByPlaceholderText(/add a tag/i), 'quick,');

        expect(onChange).toHaveBeenCalledWith(['quick']);
    });

    it('skips a duplicate tag case-insensitively', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TagsField tags={['Dinner']} onChange={onChange} />);

        await user.type(screen.getByPlaceholderText(/add a tag/i), 'dinner{Enter}');

        expect(onChange).toHaveBeenCalledWith(['Dinner']);
    });

    it('removes a tag when its remove button is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TagsField tags={['dinner', 'quick']} onChange={onChange} />);

        await user.click(screen.getByLabelText('Remove tag dinner'));

        expect(onChange).toHaveBeenCalledWith(['quick']);
    });
});
