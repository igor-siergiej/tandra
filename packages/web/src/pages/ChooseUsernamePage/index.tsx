import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth, useRefreshSession, useUser } from '../../auth';
import { authClient } from '../../auth/client';
import { authErrorMessage } from '../../auth/errors';
import LoadingPage from '../../components/LoadingPage';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useMigration } from '../../guest/useMigration';
import { usernameField } from '../../hooks/authSchemas';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { track } from '../../utils/analytics';
import { logger } from '../../utils/logger';

const chooseUsernameSchema = z.object({ username: usernameField });

type ChooseUsernameData = z.infer<typeof chooseUsernameSchema>;

const AVAILABILITY_DEBOUNCE_MS = 300;

/**
 * Where a first-time Google user lands: they are signed in but have no username yet, and the api
 * refuses app routes until they pick one. Signed-out visitors and users who already have a username
 * never stay here.
 */
// One form with its availability check, submit flow and three redirect cases; splitting would scatter them.
// fallow-ignore-next-line complexity
const ChooseUsernamePage = () => {
    const { user, needsUsername } = useUser();
    const { isLoading, logout } = useAuth();
    const refreshSession = useRefreshSession();
    const { migrateAfterAuth } = useMigration();
    const navigate = useNavigate();
    const usernameId = useId();

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<ChooseUsernameData>({
        resolver: zodResolver(chooseUsernameSchema),
        defaultValues: { username: '' },
    });

    const typed = watch('username').trim();
    const settled = useDebouncedValue(typed, AVAILABILITY_DEBOUNCE_MS);
    const checkable = chooseUsernameSchema.safeParse({ username: settled }).success;
    const availability = useQuery({
        queryKey: ['auth', 'username-available', settled.toLowerCase()],
        queryFn: async () => {
            const { data, error } = await authClient.isUsernameAvailable({ username: settled });
            if (error) throw new Error(authErrorMessage(error, "Couldn't check that username"));
            return data.available;
        },
        enabled: checkable,
        staleTime: 30_000,
    });
    // Only describe the name still in the box, never one the person has since edited.
    const describesTyped = checkable && settled === typed;
    const taken = describesTyped && availability.data === false;

    const onSubmit = async ({ username }: ChooseUsernameData) => {
        try {
            // Better Auth stores `username` lowercased; `displayUsername` keeps the casing they typed.
            const { error } = await authClient.updateUser({ username, displayUsername: username });
            if (error) {
                setError('username', { message: authErrorMessage(error, "Couldn't save that username") });
                return;
            }
            const signedIn = await refreshSession();
            // A first-time Google user only becomes a full account here, so this is their sign-up.
            track('sign_up_completed', { method: 'google' });
            await migrateAfterAuth(signedIn);
            navigate('/', { replace: true });
        } catch (error) {
            logger.warn('Choosing a username failed', { error: String(error) });
            setError('root', { message: "Couldn't save that username. Check your connection and try again." });
        }
    };

    const handleSignOut = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    if (isLoading) return <LoadingPage />;
    // Mid-submit the session already has the username; the submit itself navigates once guest data is migrated.
    if (!needsUsername && !isSubmitting) return <Navigate to={user ? '/' : '/login'} replace />;

    const status = errors.username?.message ?? errors.root?.message;
    let availabilityText: string | null = null;
    if (!status && describesTyped) {
        if (availability.isError) availabilityText = availability.error.message;
        else if (availability.data === false) availabilityText = 'That username is taken';
        else if (availability.data === true) availabilityText = 'That username is available';
    }

    return (
        <div className="flex flex-col gap-6">
            <Card className="pt-4">
                <CardHeader>
                    <CardTitle>Choose a username</CardTitle>
                    <CardDescription>
                        Friends use it to find you and share lists with you. You can't change it later.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-3">
                                <Label htmlFor={usernameId}>Username</Label>
                                <Input
                                    id={usernameId}
                                    type="text"
                                    placeholder="Pick a username"
                                    purpose="text"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    enterKeyHint="done"
                                    {...register('username')}
                                    aria-invalid={errors.username || taken ? 'true' : 'false'}
                                    disabled={isSubmitting}
                                />
                                <p
                                    aria-live="polite"
                                    className={`text-sm ${status || taken ? 'text-red-600' : 'text-muted-foreground'}`}
                                >
                                    {status ?? availabilityText}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button type="submit" className="w-full" disabled={isSubmitting || taken}>
                                    {isSubmitting ? 'Saving...' : 'Continue'}
                                </Button>
                                <Button type="button" variant="ghost" className="w-full" onClick={handleSignOut}>
                                    Sign out
                                </Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ChooseUsernamePage;
