import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import ErrorBoundary from './index';

const { mockLoggerError } = vi.hoisted(() => ({
    mockLoggerError: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        error: mockLoggerError,
    },
}));

vi.mock('../ErrorPage', () => ({
    default: ({ error }: { error: Error | null }) => (
        <div data-testid="error-page">{error?.message || 'Unknown Error'}</div>
    ),
}));

const ThrowError = () => {
    throw new Error('Test error');
};

const WorkingComponent = () => <div>Working Component</div>;

describe('ErrorBoundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <WorkingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Working Component')).toBeInTheDocument();
    });

    it('catches errors and displays ErrorPage', () => {
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('error-page')).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('renders custom fallback when error occurs and fallback provided', () => {
        render(
            <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
        expect(screen.queryByTestId('error-page')).not.toBeInTheDocument();
    });

    it('logs error to logger when caught', () => {
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(mockLoggerError).toHaveBeenCalledWith(
            'Uncaught React error',
            expect.objectContaining({
                message: 'Test error',
            })
        );
    });

    it('renders children successfully in normal operation', () => {
        render(
            <ErrorBoundary>
                <WorkingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Working Component')).toBeInTheDocument();
    });
});
