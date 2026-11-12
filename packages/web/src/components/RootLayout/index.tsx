import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

import { GuestSignUpCta } from '../../guest/GuestSignUpCta';
import { useWebMcpTools } from '../../hooks/useWebMcpTools';
import { recordInAppNavigation } from '../../utils/navigationHistory';
import Appbar from '../Appbar';
import { Layout } from '../Layout';
import NetworkStatusAlert from '../NetworkStatusAlert';

interface RootLayoutProps {
    children?: ReactNode;
    showLayout?: boolean;
}

export const RootLayout = ({ children, showLayout = true }: RootLayoutProps) => {
    const location = useLocation();
    const content = children || <Outlet />;
    useWebMcpTools();

    // biome-ignore lint/correctness/useExhaustiveDependencies: location.key drives re-firing on route change, not read in the body.
    useEffect(() => {
        recordInAppNavigation();
    }, [location.key]);

    return (
        <div className="min-h-screen bg-background flex flex-col pt-14 md:pt-16">
            {/* App pages only: the bare login/register/sign-up pages are where the guest CTA leads. */}
            <Appbar actions={showLayout ? <GuestSignUpCta /> : undefined} />
            <NetworkStatusAlert />
            {showLayout ? (
                <Layout>{content}</Layout>
            ) : (
                <main className="flex-1 flex items-center justify-center p-4">
                    <div className="w-full max-w-md">{content}</div>
                </main>
            )}
            {/* Render at the top so toasts never sit on top of the bottom app bar (ToolBar).
                offset clears the Appbar (h-14 mobile / h-16 desktop) plus a small gap so the
                toast's top edge never overlaps the Appbar. */}
            <Toaster position="top-center" offset="72px" mobileOffset="64px" />
        </div>
    );
};
