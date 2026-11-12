import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import RouterErrorHandler from './index';

// Mock ErrorPage to avoid rendering it
vi.mock('../ErrorPage', () => ({
    default: ({ error }: { error: Error }) => <div data-testid="error-page">Error: {error.message}</div>,
}));

// Mock useRouteError
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');

    return {
        ...actual,
        useRouteError: vi.fn(),
    };
});

import { useRouteError } from 'react-router-dom';

describe('RouterErrorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ErrorPage component', () => {
        const testError = new Error('Test error');
        (useRouteError as any).mockReturnValue(testError);

        const { getByTestId } = render(<RouterErrorHandler />);

        expect(getByTestId('error-page')).toBeInTheDocument();
    });

    it('handles Error instances', () => {
        const testError = new Error('Network failed');
        (useRouteError as any).mockReturnValue(testError);

        const { getByText } = render(<RouterErrorHandler />);

        expect(getByText(/Network failed/)).toBeInTheDocument();
    });

    it('converts string errors to Error objects', () => {
        (useRouteError as any).mockReturnValue('Something went wrong');

        const { getByText } = render(<RouterErrorHandler />);

        expect(getByText(/Something went wrong/)).toBeInTheDocument();
    });

    it('converts object with message property to Error', () => {
        (useRouteError as any).mockReturnValue({ message: 'Object error' });

        const { getByText } = render(<RouterErrorHandler />);

        expect(getByText(/Object error/)).toBeInTheDocument();
    });

    it('handles unknown error types with default message', () => {
        (useRouteError as any).mockReturnValue({ someField: 'value' });

        const { getByText } = render(<RouterErrorHandler />);

        expect(getByText(/An unknown routing error occurred/)).toBeInTheDocument();
    });

    it('handles null/undefined errors with default message', () => {
        (useRouteError as any).mockReturnValue(null);

        const { getByText } = render(<RouterErrorHandler />);

        expect(getByText(/An unknown routing error occurred/)).toBeInTheDocument();
    });
});
