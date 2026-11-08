import { expect, type Page } from '@playwright/test';

// Runs before every visual-regression screenshot. Waits out web-font swap
// (self-hosted Montserrat Variable loads async), then explicitly asserts
// it actually loaded — document.fonts.ready resolves even if the
// font fetch failed/was blocked, silently falling back to a default
// sans-serif, so document.fonts.check() here doubles as an assertion that
// the font really loaded rather than a mass, confusing pixel-diff. Also
// blurs whatever's focused, clearing any autoFocused field's blinking text
// caret so the screenshot doesn't capture nondeterministic caret blink — a
// no-op on pages with nothing focused.
export const settle = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => document.fonts.check('600 16px "Montserrat Variable"'))).toBe(true);
    await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
};
