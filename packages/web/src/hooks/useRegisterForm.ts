import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useRefreshSession } from '../auth';
import { authClient } from '../auth/client';
import { authErrorMessage } from '../auth/errors';
import { useMigration } from '../guest/useMigration';
import { track } from '../utils/analytics';
import { logger } from '../utils/logger';
import { usernameField } from './authSchemas';

const passwordRule = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
const passwordMessage = 'At least 8 characters, letters and digits only, must include both letters and a number';

export const registerSchema = z
    .object({
        username: usernameField,
        password: z
            .string()
            .min(1, 'Password is required')
            .regex(passwordRule, passwordMessage)
            .max(100, 'Password must not exceed 100 characters'),
        repeatPassword: z
            .string()
            .min(1, 'Please confirm your password')
            .max(100, 'Password must not exceed 100 characters'),
    })
    .refine((data) => data.password === data.repeatPassword, {
        message: 'Passwords do not match',
        path: ['repeatPassword'],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

export const useRegisterForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const refreshSession = useRefreshSession();
    const { migrateAfterAuth } = useMigration();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    // Sign up, re-read the session, migrate guest data, navigate; any failure lands in the form error.
    // fallow-ignore-next-line complexity
    const onSubmit = async (data: RegisterFormData) => {
        logger.info('Registration attempt', { username: data.username });

        try {
            // The api replaces whatever email arrives with its own `<uuid>@users.invalid` placeholder;
            // Better Auth's client just requires the field.
            const { error } = await authClient.signUp.email({
                username: data.username,
                password: data.password,
                name: data.username,
                email: `${crypto.randomUUID()}@users.invalid`,
            });
            if (error) throw new Error(authErrorMessage(error, 'Registration failed'));

            const user = await refreshSession();
            track('sign_up_completed', { method: 'password' });
            logger.info('Registration successful', { username: data.username });

            // The most common path here is a guest who just clicked "Sign up to
            // save" from the banner. Migrate before they navigate so the new
            // account lands with their lists already populated.
            await migrateAfterAuth(user);

            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Registration failed';
            logger.warn('Registration failed', { username: data.username, error: errorMessage });
            setError('root', { message: errorMessage });
        }
    };

    return {
        register,
        handleSubmit,
        errors,
        isSubmitting,
        onSubmit,
    };
};
