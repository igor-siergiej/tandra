import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useUser } from '../../auth';
import { authClient } from '../../auth/client';
import { oauthErrorMessage } from '../../auth/errors';
import { Button } from '../../components/ui/button';
import { useAuthFeatures } from '../../utils/useAiFeatures';

/**
 * Settings → Account: who you are signed in as, and a way to link Google so a forgotten password is
 * never the end of the account (there is no email to reset it with).
 */
// Username, Google link state (loading, linked, linkable) and the callback error in one small section.
// fallow-ignore-next-line complexity
export const AccountSection = () => {
    const { user } = useUser();
    const { googleSignIn } = useAuthFeatures();
    const [searchParams] = useSearchParams();
    const [linking, setLinking] = useState(false);
    const [linkFailed, setLinkFailed] = useState(false);

    const accounts = useQuery({
        queryKey: ['auth', 'accounts', user?.id],
        queryFn: async () => {
            const { data, error } = await authClient.listAccounts();
            if (error) throw new Error(error.message ?? 'Could not load linked accounts');
            return data;
        },
        enabled: Boolean(user) && googleSignIn,
    });

    if (!user) return null;

    const googleLinked = accounts.data?.some((account) => account.providerId === 'google') ?? false;
    const callbackError = searchParams.get('error');

    const handleLink = async () => {
        setLinking(true);
        setLinkFailed(false);
        const { error } = await authClient
            .linkSocial({ provider: 'google', callbackURL: '/settings', errorCallbackURL: '/settings' })
            .catch(() => ({ error: true }));
        if (error) {
            setLinking(false);
            setLinkFailed(true);
        }
    };

    return (
        <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
            <div className="space-y-3 rounded-xl border border-border px-4 py-3">
                <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Signed in as</span>
                    <span className="text-sm font-medium text-foreground">{user.username}</span>
                </div>
                {googleSignIn && accounts.isSuccess && googleLinked && (
                    <p className="text-sm text-muted-foreground">Google linked</p>
                )}
                {googleSignIn && accounts.isSuccess && !googleLinked && (
                    <Button type="button" variant="outline" className="w-full" onClick={handleLink} disabled={linking}>
                        Link Google account
                    </Button>
                )}
                {callbackError && (
                    <p className="text-sm text-red-600">
                        {oauthErrorMessage(callbackError, "Couldn't link Google. Please try again.")}
                    </p>
                )}
                {linkFailed && <p className="text-sm text-red-600">Couldn't reach Google. Please try again.</p>}
            </div>
        </section>
    );
};
