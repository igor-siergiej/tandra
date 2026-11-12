import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { TodoTimeField } from './index';

describe('TodoTimeField', () => {
    it('shows the chosen time and reports changes as HH:mm', () => {
        const onChange = vi.fn();
        render(<TodoTimeField value="08:15" onChange={onChange} />);

        const input = screen.getByLabelText('Time (Optional)');
        expect(input).toHaveValue('08:15');
        expect(input).toHaveAttribute('type', 'time');

        fireEvent.change(input, { target: { value: '09:45' } });
        expect(onChange).toHaveBeenCalledWith('09:45');
    });

    it('reports undefined when the time is cleared', () => {
        const onChange = vi.fn();
        render(<TodoTimeField value="08:15" onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Time (Optional)'), { target: { value: '' } });

        expect(onChange).toHaveBeenCalledWith(undefined);
    });
});
