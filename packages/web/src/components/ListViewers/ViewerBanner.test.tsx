import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ViewerBanner } from './ViewerBanner';

const viewer = (username: string) => ({ id: `id-${username}`, username });

describe('ViewerBanner', () => {
    it('renders nothing when nobody else has the list open', () => {
        render(<ViewerBanner viewers={[]} />);

        expect(screen.queryByTestId('list-viewers')).not.toBeInTheDocument();
    });

    it.each([
        [['alice'], 'alice is also viewing this list'],
        [['alice', 'bob'], 'alice and bob are also viewing this list'],
        [['alice', 'bob', 'cara', 'dan'], 'alice, bob and 2 more are also viewing this list'],
    ])('names %j', (names, text) => {
        render(<ViewerBanner viewers={names.map(viewer)} />);

        expect(screen.getByTestId('list-viewers')).toHaveTextContent(text);
    });
});
