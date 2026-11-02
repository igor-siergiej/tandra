import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const social = vi.fn();

vi.mock('../../auth/client', () => ({
    authClient: { signIn: { social: (...args: unknown[]) => social(...args) } },
}));

const features = { googleSignIn: true };

vi.mock('../../utils/useAiFeatures', () => ({ useAuthFeatures: () => features }));

import { GoogleButton } from './index';

describe('GoogleButton', () => {
    beforeEach(() => {
        features.googleSignIn = true;
        social.mockReset().mockResolvedValue({ data: { url: 'https://accounts.google.com', redirect: true } });
    });

    it('starts Google sign-in, sending first-timers to pick a username', async () => {
        const user = userEvent.setup();
        render(<GoogleButton />);

        await user.click(screen.getByRole('button', { name: 'Continue with Google' }));

        expect(social).toHaveBeenCalledWith({
            provider: 'google',
            callbackURL: '/',
            newUserCallbackURL: '/choose-username',
            errorCallbackURL: '/login',
        });
    });

    it('is hidden when the server has Google sign-in off', () => {
        features.googleSignIn = false;
        const { container } = render(<GoogleButton />);
        expect(container).toBeEmptyDOMElement();
    });
});
