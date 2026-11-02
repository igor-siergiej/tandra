import type { Page } from '@playwright/test';

export class DiscoverPage {
    constructor(private page: Page) {}

    get heading() {
        return this.page.getByRole('heading', { name: 'Discover recipes' });
    }

    get searchInput() {
        return this.page.getByPlaceholder('Search recipes, e.g. lemon cake');
    }

    get filtersButton() {
        return this.page.getByRole('button', { name: /^Filters/ });
    }

    card(title: string) {
        return this.page.getByRole('button', { name: new RegExp(title) });
    }

    /** A facet chip, optionally within one facet group: a value can be both a tag and an ingredient ("lemon"). */
    filterChip(name: RegExp, group?: 'Difficulty' | 'Total time' | 'Tags' | 'Ingredients') {
        const scope = group
            ? this.page.getByTestId('discover-filters').getByRole('group', { name: group })
            : this.page.getByTestId('discover-filters');

        return scope.getByRole('button', { name });
    }

    async goto() {
        await this.page.goto('/discover');
    }

    /** The way a user gets here: Recipes page, Actions menu. */
    async openFromRecipes() {
        await this.page.goto('/recipes');
        await this.page.getByRole('button', { name: 'Actions' }).click();
        await this.page.getByRole('button', { name: 'Discover Recipes' }).click();
    }

    async openFilters() {
        await this.filtersButton.click();
    }
}
