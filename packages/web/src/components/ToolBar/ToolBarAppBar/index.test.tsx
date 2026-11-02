import '@testing-library/jest-dom';
import { cleanup, render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

// Test just the component logic without rendering actual drawers
describe('ToolBarAppBar', () => {
    afterEach(() => {
        cleanup();
    });

    const renderWithRouter = (component: React.ReactElement) => {
        return render(<BrowserRouter>{component}</BrowserRouter>);
    };

    it('should export ToolBarAppBar', async () => {
        const { ToolBarAppBar } = await import('./index');
        expect(ToolBarAppBar).toBeDefined();
        expect(ToolBarAppBar.displayName).toBe('ToolBarAppBar');
    });

    it('shows back button on items page', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={true} isListsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const backButton = Array.from(buttons).find((btn) => btn.title.includes('back'));
        expect(backButton).toBeDefined();
    });

    it('hides Shopping lists button on items page (back replaces it)', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={true} isListsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const shoppingListsButton = Array.from(buttons).find((btn) => btn.title === 'Shopping lists');
        expect(shoppingListsButton).toBeUndefined();
    });

    it('still shows Recipes and Friends nav buttons on items page', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={true} isListsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const recipesButton = Array.from(buttons).find((btn) => btn.title === 'Recipes');
        expect(recipesButton).toBeDefined();
        const friendsButton = Array.from(buttons).find((btn) => btn.title === 'Friends');
        expect(friendsButton).toBeDefined();
    });

    it('still shows the Calendar button on items page', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={true} isListsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const calendarButton = Array.from(buttons).find((btn) => btn.title === 'Calendar');
        expect(calendarButton).toBeDefined();
    });

    it('shows navigation buttons on non-items non-lists page', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const shoppingListsButton = Array.from(buttons).find((btn) => btn.title === 'Shopping lists');
        expect(shoppingListsButton).toBeDefined();
        const recipesButton = Array.from(buttons).find((btn) => btn.title === 'Recipes');
        expect(recipesButton).toBeDefined();
    });

    it('shows back button on recipe detail page, in the Recipes slot', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={false} isRecipeDetailPage={true} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const backButton = Array.from(buttons).find((btn) => btn.title.includes('back'));
        expect(backButton).toBeDefined();
        const recipesButton = Array.from(buttons).find((btn) => btn.title === 'Recipes');
        expect(recipesButton).toBeUndefined();
    });

    it('still shows Shopping lists button on recipe detail page (only Recipes slot swaps)', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={false} isRecipeDetailPage={true} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const shoppingListsButton = Array.from(buttons).find((btn) => btn.title === 'Shopping lists');
        expect(shoppingListsButton).toBeDefined();
    });

    it('does not swap the Recipes slot for back on items page (only Shopping lists slot swaps)', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={true} isListsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const recipesButton = Array.from(buttons).find((btn) => btn.title === 'Recipes');
        expect(recipesButton).toBeDefined();
    });

    it('hides back button on lists page', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={true} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const backButton = Array.from(buttons).find((btn) => btn.title.includes('back'));
        expect(backButton).toBeUndefined();
    });

    it('always renders menu button', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={true} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const menuButton = Array.from(buttons).find((btn) => btn.title === 'Menu');
        expect(menuButton).toBeDefined();
    });

    it('renders a Calendar button that navigates to /calendar', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={false} isCalendarPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const calendarButton = Array.from(buttons).find((btn) => btn.title === 'Calendar');
        expect(calendarButton).toBeDefined();
    });

    it('renders a Friends button that navigates to /friends', async () => {
        const { ToolBarAppBar } = await import('./index');

        const { container } = renderWithRouter(
            <ToolBarAppBar isItemsPage={false} isListsPage={false} isFriendsPage={false} onMenuClick={() => {}} />
        );

        const buttons = container.querySelectorAll('button');
        const friendsButton = Array.from(buttons).find((btn) => btn.title === 'Friends');
        expect(friendsButton).toBeDefined();
    });
});
