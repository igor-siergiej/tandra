import { Lock, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useGuest } from '../../guest/GuestContext';
import { track } from '../../utils/analytics';

const REASON_COPY: Record<string, { title: string; description: string }> = {
    'auth-required': {
        title: 'This needs an account',
        description: 'Sign up to use sharing, AI helpers, the calendar, and recipe discovery.',
    },
};

const fallback = {
    title: 'This needs an account',
    description: 'Create a free account to keep your lists and unlock the rest of Tandra.',
};

// Shown when a guest navigates somewhere only registered users can use
// (Discover, AI, Calendar, Friends). Offers register or log in as the way
// out — the guest's local lists are preserved across both so the migration
// still happens on success.

const stringOr = (value: unknown, otherwise: string): string => (typeof value === 'string' ? value : otherwise);

const SignUpCtaPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { exitGuestMode } = useGuest();
    const reason = stringOr(location.state?.reason, '');
    const feature = stringOr(location.state?.feature, 'unknown');
    const copy = REASON_COPY[reason] ?? fallback;

    useEffect(() => {
        track('signup_prompt_shown', { prompt: 'locked_feature', feature });
    }, [feature]);

    const act = (action: 'register' | 'login' | 'discard') =>
        track('signup_prompt_action', { prompt: 'locked_feature', action, feature });

    const handleExit = () => {
        act('discard');
        exitGuestMode();
        navigate('/');
    };

    return (
        <Card className="pt-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    {copy.title}
                </CardTitle>
                <CardDescription>{copy.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                        act('register');
                        navigate('/register');
                    }}
                >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Sign up free
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                        act('login');
                        navigate('/login');
                    }}
                >
                    I already have an account
                </Button>
                <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={handleExit}>
                    Discard guest lists and start over
                </Button>
            </CardContent>
        </Card>
    );
};

export default SignUpCtaPage;
