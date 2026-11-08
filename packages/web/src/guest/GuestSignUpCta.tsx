import { useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { track } from '../utils/analytics';
import { useGuest } from './GuestContext';

// Top-right app bar control for guests: says they're in guest mode and gives them a one-tap way to keep their
// on-device lists by signing up. Renders nothing for signed-in users.
export const GuestSignUpCta = () => {
    const { isGuest } = useGuest();
    const navigate = useNavigate();

    if (!isGuest) return null;

    return (
        <div data-testid="guest-mode-indicator" className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/80">Guest mode</span>
            <Button
                type="button"
                size="sm"
                onClick={() => {
                    track('signup_prompt_action', { prompt: 'app_bar', action: 'register' });
                    navigate('/register');
                }}
                className="bg-white text-primary shadow-sm hover:bg-white/90"
            >
                Sign up
            </Button>
        </div>
    );
};
