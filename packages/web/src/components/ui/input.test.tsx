import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vite-plus/test';

import { Input } from './input';

describe('Input', () => {
    it('renders an inset focus ring so it cannot be clipped by ancestor overflow', () => {
        render(<Input placeholder="Search recipes..." />);

        const input = screen.getByPlaceholderText('Search recipes...');
        expect(input).toHaveClass('focus-visible:ring-inset');
    });

    it('still merges custom className with the base classes', () => {
        render(<Input placeholder="Search recipes..." className="pl-9 pr-9" />);

        const input = screen.getByPlaceholderText('Search recipes...');
        expect(input).toHaveClass('pl-9', 'pr-9', 'focus-visible:ring-inset');
    });

    it('applies the name preset when purpose="name" is set', () => {
        render(<Input placeholder="Item name" purpose="name" />);

        const input = screen.getByPlaceholderText('Item name');
        expect(input).toHaveAttribute('inputMode', 'text');
        expect(input).toHaveAttribute('autoComplete', 'off');
        expect(input).toHaveAttribute('autoCapitalize', 'words');
        expect(input).toHaveAttribute('spellcheck', 'false');
        expect(input).toHaveAttribute('enterKeyHint', 'done');
    });

    it('applies the search preset when purpose="search" is set', () => {
        render(<Input placeholder="Search recipes..." purpose="search" />);

        const input = screen.getByPlaceholderText('Search recipes...');
        expect(input).toHaveAttribute('inputMode', 'search');
        expect(input).toHaveAttribute('enterKeyHint', 'search');
    });

    it('applies the url preset when purpose="url" is set', () => {
        render(<Input placeholder="https://..." purpose="url" />);

        const input = screen.getByPlaceholderText('https://...');
        expect(input).toHaveAttribute('inputMode', 'url');
        expect(input).toHaveAttribute('autoComplete', 'off');
    });

    it('applies the number preset when purpose="number" is set', () => {
        render(<Input placeholder="e.g., 2" purpose="number" type="number" />);

        const input = screen.getByPlaceholderText('e.g., 2');
        expect(input).toHaveAttribute('inputMode', 'decimal');
    });

    it('lets an explicit prop override the preset default', () => {
        render(<Input placeholder="e.g. 5 min" purpose="number" inputMode="numeric" />);

        const input = screen.getByPlaceholderText('e.g. 5 min');
        expect(input).toHaveAttribute('inputMode', 'numeric');
    });

    it('sets no keyboard-preset attributes when purpose is omitted', () => {
        render(<Input placeholder="Recipe title" name="recipe-title" autoComplete="off" inputMode="text" />);

        const input = screen.getByPlaceholderText('Recipe title');
        expect(input).not.toHaveAttribute('autoCapitalize');
        expect(input).not.toHaveAttribute('spellcheck');
        expect(input).not.toHaveAttribute('enterKeyHint');
    });
});
