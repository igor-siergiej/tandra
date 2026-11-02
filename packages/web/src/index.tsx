import '@fontsource-variable/montserrat';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { AuthRoot } from './auth';
import AppInitializer from './components/AppInitializer';
import ConfigLoader from './components/ConfigLoader';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingPage from './components/LoadingPage';
import { RootLayout } from './components/RootLayout';
import RouterErrorHandler from './components/RouterErrorHandler';
import { PullToRefreshProvider } from './contexts/PullToRefreshContext';
import { PWAProvider } from './contexts/PWAContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { UnitSystemProvider } from './contexts/UnitSystemContext';
import { GuestAwareProtectedRoute, GuestEntryRoute, RequireAuth } from './guest/GuestAwareProtectedRoute';
import { GuestProvider } from './guest/GuestContext';
import { installPreviewApi } from './heatmapPreview/installPreviewApi';
import { isHeatmapPreview } from './heatmapPreview/isHeatmapPreview';
import { applyManifestForTheme } from './utils/applyManifestForTheme';
import { installWebMcpOriginTrialToken } from './webmcp/originTrial';

// Before anything fetches: inside the analytics dashboard's frame the pages read placeholder data.
if (isHeatmapPreview) installPreviewApi();

applyManifestForTheme();

installWebMcpOriginTrialToken(import.meta.env.VITE_WEBMCP_OT_TOKEN, __IS_PROD__);

const lazyLoadPage = (importFn: () => Promise<{ default: React.ComponentType }>, fallbackName: string) =>
    React.lazy(() =>
        importFn().catch(() => ({
            default: () => (
                <div>
                    Failed to load
                    {fallbackName}
                </div>
            ),
        }))
    );

const ItemsPage = lazyLoadPage(() => import('./pages/ItemsPage'), 'items page');
const ListPage = lazyLoadPage(() => import('./pages/ListsPage'), 'lists page');
const LoginPage = lazyLoadPage(() => import('./pages/LoginPage'), 'login page');
const RegisterPage = lazyLoadPage(() => import('./pages/RegisterPage'), 'register page');
const RecipesPage = lazyLoadPage(() => import('./pages/RecipesPage'), 'recipes page');
const AddRecipePage = lazyLoadPage(() => import('./pages/AddRecipePage'), 'add recipe page');
const RecipeDetailPage = lazyLoadPage(() => import('./pages/RecipeDetailPage'), 'recipe detail page');
const ChooseUsernamePage = lazyLoadPage(() => import('./pages/ChooseUsernamePage'), 'choose username page');
const ShareTargetPage = lazyLoadPage(() => import('./pages/ShareTargetPage'), 'share target page');
const CalendarPage = lazyLoadPage(() => import('./pages/CalendarPage'), 'calendar page');
const MealPlanPage = lazyLoadPage(() => import('./pages/MealPlanPage'), 'meal plan page');
const FriendsPage = lazyLoadPage(() => import('./pages/FriendsPage'), 'friends page');
const SettingsPage = lazyLoadPage(() => import('./pages/SettingsPage'), 'settings page');
const DiscoverPage = lazyLoadPage(() => import('./pages/DiscoverPage'), 'discover page');
const DiscoverRecipePage = lazyLoadPage(() => import('./pages/DiscoverRecipePage'), 'discover recipe page');
const UseUpIngredientPage = lazyLoadPage(() => import('./pages/UseUpIngredientPage'), 'use up ingredient page');
const SignUpCtaPage = lazyLoadPage(() => import('./pages/SignUpCtaPage'), 'sign up prompt');

// v5 pauses queries and mutations while the browser reports offline. This app is offline-first: reads are served by
// the service worker's cache and writes only go into the local outbox, so both must keep running (the v3 behaviour).
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
            networkMode: 'always',
        },
        mutations: {
            networkMode: 'always',
        },
    },
});

const router = createBrowserRouter([
    {
        path: '/login',
        element: (
            <RootLayout showLayout={false}>
                <Suspense fallback={<LoadingPage />}>
                    <LoginPage />
                </Suspense>
            </RootLayout>
        ),
        errorElement: <RouterErrorHandler />,
    },
    {
        path: '/register',
        element: (
            <RootLayout showLayout={false}>
                <Suspense fallback={<LoadingPage />}>
                    <RegisterPage />
                </Suspense>
            </RootLayout>
        ),
        errorElement: <RouterErrorHandler />,
    },
    {
        // Triggered when a guest tries to open an account-only feature (Discover, AI, Calendar, Friends).
        // The page explains what's locked and offers register / login as exits.
        path: '/signup-cta',
        element: (
            <RootLayout showLayout={false}>
                <Suspense fallback={<LoadingPage />}>
                    <SignUpCtaPage />
                </Suspense>
            </RootLayout>
        ),
        errorElement: <RouterErrorHandler />,
    },
    {
        // A first-time Google user lands here (Better Auth's newUserCallbackURL) to pick a username.
        path: '/choose-username',
        element: (
            <RootLayout showLayout={false}>
                <Suspense fallback={<LoadingPage />}>
                    <ChooseUsernamePage />
                </Suspense>
            </RootLayout>
        ),
        errorElement: <RouterErrorHandler />,
    },
    {
        // Linked from the landing site's "Try it without an account" button.
        path: '/try',
        element: <GuestEntryRoute />,
        errorElement: <RouterErrorHandler />,
    },
    {
        path: '/',
        element: (
            <AppInitializer>
                <GuestAwareProtectedRoute>
                    <RootLayout />
                </GuestAwareProtectedRoute>
            </AppInitializer>
        ),
        errorElement: <RouterErrorHandler />,
        children: [
            {
                index: true,
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <ListPage />
                    </Suspense>
                ),
            },
            {
                // Keyed by the list's display title so legacy `/list/Groceries` URLs and the new id-suffixed form
                // both work. Guests use the same page, backed by their on-device lists.
                path: 'list/:listTitle',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <ItemsPage />
                    </Suspense>
                ),
            },
            {
                path: 'list/:listTitle/:listId',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <ItemsPage />
                    </Suspense>
                ),
            },
            {
                path: 'recipes',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <RecipesPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'recipes/new',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <AddRecipePage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'recipes/use-up',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <UseUpIngredientPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'discover',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <DiscoverPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'discover/:recipeId',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <DiscoverRecipePage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'recipes/:recipeId',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <RecipeDetailPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'share',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <ShareTargetPage />
                    </Suspense>
                ),
            },
            {
                path: 'calendar',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <CalendarPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'meal-plan',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <MealPlanPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'friends',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <RequireAuth>
                            <FriendsPage />
                        </RequireAuth>
                    </Suspense>
                ),
            },
            {
                path: 'settings',
                element: (
                    <Suspense fallback={<LoadingPage />}>
                        <SettingsPage />
                    </Suspense>
                ),
            },
        ],
    },
]);

const AppContent: React.FC = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthRoot>
                <ThemeProvider>
                    <UnitSystemProvider>
                        <PullToRefreshProvider>
                            <PWAProvider>
                                <RouterProvider router={router} />
                            </PWAProvider>
                        </PullToRefreshProvider>
                    </UnitSystemProvider>
                </ThemeProvider>
            </AuthRoot>
        </QueryClientProvider>
    );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ConfigLoader>
                <GuestProvider>
                    <AppContent />
                </GuestProvider>
            </ConfigLoader>
        </ErrorBoundary>
    );
};

// SAFETY: index.html always contains #root; a missing node would fail createRoot immediately.
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(<App />);
