import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import NetworkStatusAlert from './index';

describe('NetworkStatusAlert', () => {
    let originalOnLine: boolean;

    beforeEach(() => {
        originalOnLine = navigator.onLine;
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: originalOnLine,
        });
    });

    it('renders null when online', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true,
        });

        const { container } = render(<NetworkStatusAlert />);

        expect(container.firstChild).toBeNull();
    });

    it('renders offline alert when offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        render(<NetworkStatusAlert />);

        expect(screen.getByText('You are offline')).toBeInTheDocument();
        expect(
            screen.getByText('Some actions may be unavailable. Recent data is shown from cache.')
        ).toBeInTheDocument();
    });

    it('displays offline alert with icon', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        const { container } = render(<NetworkStatusAlert />);

        const svgIcon = container.querySelector('svg');
        expect(svgIcon).toBeInTheDocument();
    });

    it('displays destructive styling when offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        const { container } = render(<NetworkStatusAlert />);

        const alertDiv = container.querySelector('div[class*="border"]');
        expect(alertDiv).toBeInTheDocument();
        expect(alertDiv).not.toBeNull();
    });

    it('renders fixed positioning', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        const { container } = render(<NetworkStatusAlert />);

        const outerDiv = container.querySelector('div[class*="fixed"]');
        expect(outerDiv).toBeInTheDocument();
    });

    it('renders with max width constraint', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        const { container } = render(<NetworkStatusAlert />);

        const innerDiv = container.querySelector('div[class*="max-w"]');
        expect(innerDiv).toBeInTheDocument();
    });

    it('has alert title and description structure', () => {
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        render(<NetworkStatusAlert />);

        const title = screen.getByText('You are offline');
        expect(title).toBeInTheDocument();

        const description = screen.getByText('Some actions may be unavailable. Recent data is shown from cache.');
        expect(description).toBeInTheDocument();
    });
});
