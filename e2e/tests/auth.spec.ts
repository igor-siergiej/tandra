import { expect, test } from '../fixtures';

const freshUsername = () => `user${Date.now()}${Math.floor(Math.random() * 1000)}`;

// The live run starts on a host that redirects to the app's own host, so match the path only.
const atPath = (path: string) => (url: URL) => url.pathname === path;

test.describe('Login', () => {
    test('renders login form', async ({ loginPage }) => {
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();
        await expect(loginPage.usernameInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.submitButton).toBeVisible();
    });

    test('shows validation error on empty submit', async ({ page, loginPage }) => {
        await loginPage.goto();
        await loginPage.submitButton.click();
        await expect(page.getByText('Username is required')).toBeVisible();
    });

    test('shows validation error for short username', async ({ page, loginPage }) => {
        await loginPage.goto();
        await loginPage.usernameInput.fill('ab');
        await loginPage.submitButton.click();
        await expect(page.getByText('Username must be at least 3 characters')).toBeVisible();
    });

    test('valid credentials redirect to home', async ({ page, loginPage }) => {
        await loginPage.goto();
        await loginPage.login('testuser', 'password123');
        await page.waitForURL('/');
        await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    });

    test('link navigates to register page', async ({ page, loginPage }) => {
        await loginPage.goto();
        await loginPage.registerLink.click();
        await page.waitForURL('/register');
    });

    test('unauthenticated access to / redirects to /login', async ({ page }) => {
        await page.goto('/');
        await page.waitForURL('/login');
    });
});

test.describe('Register', () => {
    test('renders register form', async ({ registerPage }) => {
        await registerPage.goto();
        await expect(registerPage.heading).toBeVisible();
        await expect(registerPage.usernameInput).toBeVisible();
        await expect(registerPage.passwordInput).toBeVisible();
        await expect(registerPage.repeatPasswordInput).toBeVisible();
        await expect(registerPage.submitButton).toBeVisible();
    });

    test('shows error when passwords do not match', async ({ page, registerPage }) => {
        await registerPage.goto();
        await registerPage.register('newuser', 'password123', 'different');
        await expect(page.getByText('Passwords do not match')).toBeVisible();
    });

    test('valid registration redirects to home', async ({ page, registerPage }) => {
        await registerPage.goto();
        await registerPage.register(freshUsername(), 'password123', 'password123');
        await page.waitForURL('/');
    });

    test('link navigates to login page', async ({ page, registerPage }) => {
        await registerPage.goto();
        await registerPage.loginLink.click();
        await page.waitForURL('/login');
    });
});

test.describe('Logout', () => {
    test('logout redirects to /login', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await expect(authenticatedPage.getByRole('button', { name: 'Menu' })).toBeVisible();
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();
        await authenticatedPage.getByRole('button', { name: 'Log out' }).click();
        await authenticatedPage.waitForURL('/login');
    });

    test('a reload after logging out stays signed out', async ({ authenticatedPage }) => {
        await authenticatedPage.goto('/');
        await authenticatedPage.getByRole('button', { name: 'Menu' }).click();
        await authenticatedPage.getByRole('button', { name: 'Log out' }).click();
        await authenticatedPage.waitForURL('/login');

        await authenticatedPage.goto('/');

        await authenticatedPage.waitForURL('/login');
    });
});

// Safe against production: it only creates a throwaway account with a random name.
test('@smoke a new account can register, sign out, and sign back in', async ({ page, registerPage, loginPage }) => {
    test.setTimeout(30_000);
    const username = freshUsername();

    await registerPage.goto();
    await registerPage.register(username, 'smokepass123', 'smokepass123');
    await page.waitForURL(atPath('/'));
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(atPath('/login'));

    await loginPage.login(username, 'smokepass123');
    await page.waitForURL(atPath('/'));
    await expect(page.getByText('No lists yet')).toBeVisible();
});
