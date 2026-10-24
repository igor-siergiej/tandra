import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './index';

const mockUseLoginForm = vi.fn();
const mockEnterGuestMode = vi.fn();

vi.mock('../../hooks/useLoginForm', () => ({
    useLoginForm: () => mockUseLoginForm(),
}));

vi.mock('../../guest/GuestContext', () => ({
    useGuest: () => ({
        isGuest: false,
        enterGuestMode: mockEnterGuestMode,
        exitGuestMode: vi.fn(),
    }),
}));

let searchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useSearchParams: () => [searchParams],
}));

vi.mock('./LoginFormFields', () => ({
    LoginFormFields: () => <div data-testid="form-fields">Form Fields</div>,
}));

vi.mock('../GoogleButton', () => ({
    GoogleButton: () => <button type="button">Continue with Google</button>,
}));

describe('LoginForm', () => {
    beforeEach(() => {
        searchParams = new URLSearchParams();
        mockUseLoginForm.mockReturnValue({
            register: vi.fn(),
            handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
                e.preventDefault();
                fn({});
            },
            errors: {},
            isSubmitting: false,
            onSubmit: vi.fn(),
        });
    });

    it('renders card with header and description', () => {
        render(<LoginForm />);

        expect(screen.getByText('Login to your account')).toBeInTheDocument();
        expect(screen.getByText('Enter your username below to login to your account')).toBeInTheDocument();
    });

    it('renders LoginFormFields component', () => {
        render(<LoginForm />);

        expect(screen.getByTestId('form-fields')).toBeInTheDocument();
    });

    it('renders login button', () => {
        render(<LoginForm />);

        const submitButton = screen.getByRole('button', { name: /login/i });
        expect(submitButton).toBeInTheDocument();
        expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('shows loading state when submitting', () => {
        mockUseLoginForm.mockReturnValue({
            register: vi.fn(),
            handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
                e.preventDefault();
                fn({});
            },
            errors: {},
            isSubmitting: true,
            onSubmit: vi.fn(),
        });

        render(<LoginForm />);

        const submitButton = screen.getByRole('button', { name: /logging in/i });
        expect(submitButton).toBeDisabled();
    });

    it('displays root error when present', () => {
        mockUseLoginForm.mockReturnValue({
            register: vi.fn(),
            handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
                e.preventDefault();
                fn({});
            },
            errors: { root: { message: 'Login failed' } },
            isSubmitting: false,
            onSubmit: vi.fn(),
        });

        render(<LoginForm />);

        expect(screen.getByText('Login failed')).toBeInTheDocument();
    });

    it('renders sign up link', () => {
        render(<LoginForm />);

        const signUpLink = screen.getByRole('link', { name: /sign up/i });
        expect(signUpLink).toHaveAttribute('href', '/register');
    });

    it('offers Google sign-in', () => {
        render(<LoginForm />);
        expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    });

    it('explains a Google sign-in that came back with an error', () => {
        searchParams = new URLSearchParams('error=access_denied');
        render(<LoginForm />);
        expect(screen.getByText('Google sign-in was cancelled.')).toBeInTheDocument();
    });

    it('falls back to a general message for unknown Google errors', () => {
        searchParams = new URLSearchParams('error=something_new');
        render(<LoginForm />);
        expect(screen.getByText("Couldn't sign in with Google. Please try again.")).toBeInTheDocument();
    });

    it('links to the privacy notice in a new tab', () => {
        render(<LoginForm />);

        const link = screen.getByRole('link', { name: 'Privacy' });
        expect(link).toHaveAttribute('href', 'https://tandra.uk/privacy');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener');
    });
});
