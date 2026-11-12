import '@testing-library/jest-dom';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { ToolBarButton } from './index';

describe('ToolBarButton', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders button with icon', () => {
        const TestIcon = () => <span>icon</span>;
        const { getByRole } = render(<ToolBarButton icon={TestIcon} title="Test" onClick={() => {}} />);

        expect(getByRole('button')).toBeInTheDocument();
        expect(getByRole('button')).toHaveAttribute('title', 'Test');
    });

    it('calls onClick handler when clicked', () => {
        let called = false;
        const TestIcon = () => <span>icon</span>;

        const { getByRole } = render(
            <ToolBarButton
                icon={TestIcon}
                title="Test"
                onClick={() => {
                    called = true;
                }}
            />
        );

        const button = getByRole('button');
        button.click();
        expect(called).toBe(true);
    });

    it('disables button when disabled prop is true', () => {
        const TestIcon = () => <span>icon</span>;
        const { getByRole } = render(<ToolBarButton icon={TestIcon} title="Test" onClick={() => {}} disabled={true} />);

        expect(getByRole('button')).toBeDisabled();
    });

    it('applies variant styling for destructive', () => {
        const TestIcon = () => <span>icon</span>;

        const { container } = render(
            <ToolBarButton icon={TestIcon} title="Test" onClick={() => {}} variant="destructive" />
        );

        const button = container.querySelector('button');
        expect(button).toHaveClass('text-destructive');
    });

    it('renders with proper styling classes', () => {
        const TestIcon = () => <span>icon</span>;
        const { container } = render(<ToolBarButton icon={TestIcon} title="Test" onClick={() => {}} />);

        const button = container.querySelector('button');
        expect(button).toHaveClass('h-12', 'w-12', 'rounded-full');
    });
});
