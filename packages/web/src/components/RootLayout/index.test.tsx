import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RootLayout } from './index';

const { mockRecordInAppNavigation } = vi.hoisted(() => ({
    mockRecordInAppNavigation: vi.fn(),
}));

vi.mock('../../hooks/useWebMcpTools', () => ({ useWebMcpTools: vi.fn() }));

vi.mock('../Appbar', () => ({
    default: () => <div data-testid="appbar">Appbar</div>,
}));

vi.mock('../NetworkStatusAlert', () => ({
    default: () => <div data-testid="network-alert">Network Alert</div>,
}));

vi.mock('../Layout', () => ({
    Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('sonner', () => ({
    Toaster: (props: { position?: string; offset?: string; mobileOffset?: string }) => (
        <div
            data-testid="toaster"
            data-position={props.position}
            data-offset={props.offset}
            data-mobile-offset={props.mobileOffset}
        />
    ),
}));

vi.mock('react-router-dom', () => ({
    Outlet: () => <div data-testid="outlet">Outlet</div>,
    useLocation: () => ({ key: 'default', pathname: '/' }),
}));

vi.mock('../../utils/navigationHistory', () => ({
    recordInAppNavigation: mockRecordInAppNavigation,
}));

describe('RootLayout', () => {
    it('renders Appbar and NetworkStatusAlert', () => {
        render(<RootLayout />);

        expect(screen.getByTestId('appbar')).toBeInTheDocument();
        expect(screen.getByTestId('network-alert')).toBeInTheDocument();
    });

    it('renders Toaster for notifications', () => {
        render(<RootLayout />);

        expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });

    it('positions Toaster at the top with an offset that clears the Appbar', () => {
        render(<RootLayout />);

        const toaster = screen.getByTestId('toaster');
        expect(toaster).toHaveAttribute('data-position', 'top-center');
        expect(toaster).toHaveAttribute('data-offset', '72px');
        expect(toaster).toHaveAttribute('data-mobile-offset', '64px');
    });

    it('renders children with Layout when showLayout is true', () => {
        render(
            <RootLayout showLayout={true}>
                <div>Test Content</div>
            </RootLayout>
        );

        expect(screen.getByTestId('layout')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders Outlet by default', () => {
        render(<RootLayout />);

        expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('renders children without Layout when showLayout is false', () => {
        const { container } = render(
            <RootLayout showLayout={false}>
                <div>Test Content</div>
            </RootLayout>
        );

        expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();

        const mainElement = container.querySelector('main');
        expect(mainElement).toHaveClass('flex-1', 'flex', 'items-center', 'justify-center');
    });

    it('records an in-app navigation on mount', () => {
        render(<RootLayout />);

        expect(mockRecordInAppNavigation).toHaveBeenCalled();
    });
});
