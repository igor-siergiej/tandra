import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import { RegisterFormFields } from './index';

describe('RegisterFormFields', () => {
    const mockRegister = vi.fn((name: string) => ({
        name,
        onChange: vi.fn(),
        onBlur: vi.fn(),
    }));

    const defaultProps = {
        register: mockRegister,
        errors: {},
        isSubmitting: false,
    };

    it('renders username input', () => {
        render(<RegisterFormFields {...defaultProps} />);

        expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('renders password input', () => {
        render(<RegisterFormFields {...defaultProps} />);

        const passwordInputs = screen.getAllByPlaceholderText(/Enter your password/);
        expect(passwordInputs[0]).toHaveAttribute('type', 'password');
    });

    it('renders repeat password input', () => {
        render(<RegisterFormFields {...defaultProps} />);

        expect(screen.getByPlaceholderText('Repeat your password')).toBeInTheDocument();
        expect(screen.getByLabelText('Repeat Password')).toBeInTheDocument();
    });

    it('disables inputs when submitting', () => {
        render(<RegisterFormFields {...defaultProps} isSubmitting={true} />);

        expect(screen.getByPlaceholderText('Enter your username')).toBeDisabled();
        expect(screen.getByPlaceholderText('Repeat your password')).toBeDisabled();
    });

    it('shows username error message', () => {
        const props = {
            ...defaultProps,
            errors: {
                username: { message: 'Username is required' },
            },
        };

        render(<RegisterFormFields {...props} />);

        expect(screen.getByText('Username is required')).toBeInTheDocument();
    });

    it('shows password error message', () => {
        const props = {
            ...defaultProps,
            errors: {
                password: { message: 'Password is too short' },
            },
        };

        render(<RegisterFormFields {...props} />);

        expect(screen.getByText('Password is too short')).toBeInTheDocument();
    });

    it('shows repeat password error message', () => {
        const props = {
            ...defaultProps,
            errors: {
                repeatPassword: { message: 'Passwords do not match' },
            },
        };

        render(<RegisterFormFields {...props} />);

        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    it('sets aria-invalid when field has error', () => {
        const props = {
            ...defaultProps,
            errors: {
                username: { message: 'Username is required' },
            },
        };

        render(<RegisterFormFields {...props} />);

        expect(screen.getByPlaceholderText('Enter your username')).toHaveAttribute('aria-invalid', 'true');
    });
});
