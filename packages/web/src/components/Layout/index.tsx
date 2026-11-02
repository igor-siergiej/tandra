import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { usePullToRefreshContext } from '../../contexts/PullToRefreshContext';
import { ScrollContainerProvider } from '../../contexts/ScrollContainerContext';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../PullToRefreshIndicator';

interface LayoutProps {
    children: ReactNode;
}

// Routes whose content needs normal (top-anchored, non-reversed) scroll semantics.
// Every other route keeps the default flex-col-reverse (bottom-anchored, chat-like)
// container. See Layout/index.test.tsx and CalendarPage/index.tsx's own comment for
// why flex-col-reverse's scrollTop behavior can't be trusted once content overflows:
// it broke pull-to-refresh's "am I at the top" check on the Recipes page, which has
// no need for bottom-anchoring in the first place.
const NORMAL_SCROLL_ROUTES: Record<string, true> = {
    '/recipes': true,
    '/recipes/use-up': true,
    '/discover': true,
    '/meal-plan': true,
    '/settings': true,
};

// Recipe Detail (`/recipes/:recipeId`) is a dynamic segment, so it can't live in the
// static NORMAL_SCROLL_ROUTES map above — same reversed-flex bug as the Recipes page
// (#122), scoped to its own ingredients/steps overflow. Excludes the sibling static
// routes that also start with "/recipes/" and are handled elsewhere.
const RECIPE_DETAIL_ROUTE = /^\/recipes\/(?!new$|use-up$)[^/]+$/;

// A library recipe preview (`/discover/:recipeId`) scrolls its ingredients and steps the same way.
const DISCOVER_PREVIEW_ROUTE = /^\/discover\/[^/]+$/;

const isNormalScrollRoute = (pathname: string): boolean =>
    !!NORMAL_SCROLL_ROUTES[pathname] || RECIPE_DETAIL_ROUTE.test(pathname) || DISCOVER_PREVIEW_ROUTE.test(pathname);

// Routes with their own full-page header/footer (no bottom ToolBar) — they don't need
// the bottom-24 space Layout normally reserves for it, or Layout's own padding.
const FULL_BLEED_ROUTES: Record<string, true> = { '/recipes/new': true };

// Routes whose content is a grid rather than a single column. The 500px cap that suits
// the list-style pages squeezes RecipesList's sm:grid-cols-2 / lg:grid-cols-3 grid into
// a narrow strip on desktop, so those routes widen from the same breakpoint the grid
// starts adding columns at.
const WIDE_ROUTES: Record<string, true> = { '/recipes': true };

export const Layout = ({ children }: LayoutProps) => {
    const { executeRefresh } = usePullToRefreshContext();
    const { scrollRef, pullY, isRefreshing, hasTriggered } = usePullToRefresh(executeRefresh);
    const { pathname } = useLocation();

    const flexDirectionClass = isNormalScrollRoute(pathname) ? 'flex-col' : 'flex-col-reverse';
    const widthClass = WIDE_ROUTES[pathname] ? 'max-w-[500px] sm:max-w-5xl' : 'max-w-[500px]';
    const containerClass = FULL_BLEED_ROUTES[pathname]
        ? 'fixed top-14 md:top-16 bottom-0 left-0 right-0'
        : `fixed top-14 md:top-16 bottom-24 left-0 right-0 px-4 py-2 mx-auto ${widthClass}`;

    return (
        <div className={containerClass}>
            <PullToRefreshIndicator pullY={pullY} isRefreshing={isRefreshing} hasTriggered={hasTriggered} />
            <div ref={scrollRef} className={`h-full overflow-y-auto flex ${flexDirectionClass} overscroll-y-contain`}>
                <ScrollContainerProvider scrollRef={scrollRef}>{children}</ScrollContainerProvider>
            </div>
        </div>
    );
};
