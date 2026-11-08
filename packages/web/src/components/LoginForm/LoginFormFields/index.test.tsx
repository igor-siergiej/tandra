import '@testing-library/jest-dom';
import { cleanup, render } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { narrowTo } from '../../../testing/fake';
import { LoginFormFields } from './index';

describe('LoginFormFields', () => {
    afterEach(() => {
        cleanup();
    });

    const TestWrapper = () => {
        const {
            register,
            formState: { errors },
        } = useForm({
            defaultValues: { username: '', password: '' },
        });

        return <LoginFormFields register={register} errors={errors} isSubmitting={false} />;
    };

    it('renders username and password input fields', () => {
        const { container } = render(<TestWrapper />);

        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBe(2);
    });

    it('renders username label', () => {
        const { container } = render(<TestWrapper />);

        expect(container.textContent).toContain('Username');
    });

    it('renders password label', () => {
        const { container } = render(<TestWrapper />);

        expect(container.textContent).toContain('Password');
    });

    it('has correct input placeholders', () => {
        const { container } = render(<TestWrapper />);

        const usernameInput = narrowTo(container.querySelector('input[type="text"]'), HTMLInputElement);
        const passwordInput = narrowTo(container.querySelector('input[type="password"]'), HTMLInputElement);

        expect(usernameInput?.placeholder).toBe('Enter your username');
        expect(passwordInput?.placeholder).toBe('Enter your password');
    });

    it('disables inputs when submitting', () => {
        const DisabledTestWrapper = () => {
            const {
                register,
                formState: { errors },
            } = useForm({
                defaultValues: { username: '', password: '' },
            });

            return <LoginFormFields register={register} errors={errors} isSubmitting={true} />;
        };

        const { container } = render(<DisabledTestWrapper />);

        const inputs = container.querySelectorAll('input');
        inputs.forEach((input) => {
            expect(narrowTo(input, HTMLInputElement).disabled).toBe(true);
        });
    });
});
