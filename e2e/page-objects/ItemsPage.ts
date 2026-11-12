import type { Page } from '@playwright/test';

export class ItemsPage {
    constructor(private page: Page) {}

    get emptyStateText() {
        return this.page.getByText('No items yet').or(this.page.getByText('No tasks yet'));
    }

    get actionsFabButton() {
        return this.page.getByRole('button', { name: 'Actions' });
    }

    get clearSelectedButton() {
        return this.page.getByRole('button', { name: 'Clear Selected' });
    }

    get clearAllButton() {
        return this.page.getByRole('button', { name: 'Remove All' });
    }

    get goBackButton() {
        return this.page.getByRole('button', { name: 'Go back' });
    }

    get addItemDrawerTitle() {
        return this.page.getByText('Add New Item', { exact: true });
    }

    get itemNameInput() {
        return this.page.getByPlaceholder('Enter item name...');
    }

    get addItemSubmit() {
        return this.page.getByRole('button', { name: 'Add Item' });
    }

    get editItemDrawerTitle() {
        return this.page.getByText('Edit Item', { exact: true });
    }

    get saveChangesButton() {
        return this.page.getByRole('button', { name: 'Save Changes' });
    }

    itemRow(name: string) {
        return this.page.getByText(name, { exact: true }).first();
    }

    async goto(listTitle: string) {
        await this.page.goto(`/list/${listTitle}`);
    }

    async openAddItemDrawer() {
        await this.page.locator('button[class*="border-primary"]').first().click();
    }

    async addItem(name: string) {
        await this.openAddItemDrawer();
        await this.itemNameInput.fill(name);
        await this.addItemSubmit.click();
    }

    async swipeLeft(itemName: string) {
        const item = this.itemRow(itemName);
        const box = await item.boundingBox();

        if (!box) throw new Error(`Item "${itemName}" not found`);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await this.page.mouse.move(cx, cy);
        await this.page.mouse.down();
        await this.page.mouse.move(cx - 90, cy, { steps: 10 });
        await this.page.mouse.up();
        await this.page.waitForTimeout(200);
    }

    async swipeRight(itemName: string) {
        const item = this.itemRow(itemName);
        const box = await item.boundingBox();

        if (!box) throw new Error(`Item "${itemName}" not found`);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await this.page.mouse.move(cx, cy);
        await this.page.mouse.down();
        await this.page.mouse.move(cx + 90, cy, { steps: 10 });
        await this.page.mouse.up();
        await this.page.waitForTimeout(200);
    }

    async clearAllItems() {
        await this.actionsFabButton.click();
        await this.clearAllButton.click();
        await this.page.getByRole('button', { name: 'Clear All Items' }).click();
    }

    async clearSelectedItems() {
        await this.actionsFabButton.click();
        await this.clearSelectedButton.click();
        await this.page.getByRole('button', { name: 'Clear Selected' }).click();
    }

    // TODO list
    get addTaskDrawerTitle() {
        return this.page.getByText('Add New Task', { exact: true });
    }

    get taskNameInput() {
        return this.page.getByLabel('Task Name');
    }

    get dueDateButton() {
        return this.page.getByRole('button', { name: 'Pick a date' });
    }

    get dueDateOptionalLabel() {
        return this.page.getByText('Due Date (Optional)');
    }

    // AddFromRecipe drawer
    async openAddFromRecipeDrawer() {
        await this.actionsFabButton.click();
        await this.page.getByRole('button', { name: 'Add from Recipe' }).click();
    }

    async chooseRecipe(title: string) {
        await this.page.getByRole('button', { name: new RegExp(title) }).click();
    }

    async confirmAddFromRecipe() {
        await this.page.getByRole('button', { name: /Add \d+ items/ }).click();
    }
}
