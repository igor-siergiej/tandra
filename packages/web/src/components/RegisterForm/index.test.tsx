import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './index';

const mockUseRegisterForm = vi.fn();

vi.mock('../../hooks/useRegisterForm', () => ({
    useRegisterForm: () => mockUseRegisterForm(),
}));

vi.mock('./RegisterFormFields', () => ({
    RegisterFormFields: () => <div data-testid="form-fields">Register Fields</div>,
}));

vi.mock('../GoogleButton', () => ({
    GoogleButton: () => <button type="button">Continue with Google</button>,
}));

describe('RegisterForm', () => {
    beforeEach(() => {
        mockUseRegisterForm.mockReturnValue({
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
        render(<RegisterForm />);

        expect(screen.getByText('Create your account')).toBeInTheDocument();
        expect(screen.getByText('Enter your details below to create your account')).toBeInTheDocument();
    });

    it('renders RegisterFormFields component', () => {
        render(<RegisterForm />);

        expect(screen.getByTestId('form-fields')).toBeInTheDocument();
    });

    it('renders create account button', () => {
        render(<RegisterForm />);

        const submitButton = screen.getByRole('button', { name: /create account/i });
        expect(submitButton).toBeInTheDocument();
        expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('offers Google sign-in', () => {
        render(<RegisterForm />);
        expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    });

    it('disables button when submitting', () => {
        mockUseRegisterForm.mockReturnValue({
            register: vi.fn(),
            handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
                e.preventDefault();
                fn({});
            },
            errors: {},
            isSubmitting: true,
            onSubmit: vi.fn(),
        });

        render(<RegisterForm />);

        const submitButton = screen.getByRole('button', { name: 'Creating Account...' });
        expect(submitButton).toBeDisabled();
    });

    it('displays root error when present', () => {
        mockUseRegisterForm.mockReturnValue({
            register: vi.fn(),
            handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
                e.preventDefault();
                fn({});
            },
            errors: { root: { message: 'Username already exists' } },
            isSubmitting: false,
            onSubmit: vi.fn(),
        });

        render(<RegisterForm />);

        expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });

    it('renders sign in link', () => {
        render(<RegisterForm />);

        const signInLink = screen.getByRole('link', { name: /sign in/i });
        expect(signInLink).toHaveAttribute('href', '/login');
    });

    it('accepts custom className prop', () => {
        const { container } = render(<RegisterForm className="custom-class" />);

        const wrapper = container.firstChild;
        expect(wrapper).toHaveClass('custom-class');
    });

    it('links to the privacy notice in a new tab', () => {
        render(<RegisterForm />);

        const link = screen.getByRole('link', { name: 'Privacy' });
        expect(link).toHaveAttribute('href', 'https://tandra.uk/privacy');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener');
    });
});
