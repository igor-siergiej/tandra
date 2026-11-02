import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useRefreshSession } from '../auth';
import { authClient } from '../auth/client';
import { authErrorMessage } from '../auth/errors';
import { useMigration } from '../guest/useMigration';
import { logger } from '../utils/logger';
import { usernameField } from './authSchemas';

const loginSchema = z.object({
    username: usernameField,
    password: z
        .string()
        .min(1, 'Password is required')
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password must not exceed 100 characters'),
});

interface ReturnLocation {
    pathname?: string;
    search?: string;
    hash?: string;
}

const redirectTarget = ({ pathname, search = '', hash = '' }: ReturnLocation = {}): string =>
    pathname ? `${pathname}${search}${hash}` : '/';

export type LoginFormData = z.infer<typeof loginSchema>;

export const useLoginForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const refreshSession = useRefreshSession();
    const { migrateAfterAuth } = useMigration();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    // Sign in, re-read the session, migrate guest data, navigate; any failure lands in the form error.
    // fallow-ignore-next-line complexity
    const onSubmit = async (data: LoginFormData) => {
        logger.info('Login attempt', { username: data.username });

        try {
            const { error } = await authClient.signIn.username({
                username: data.username,
                password: data.password,
            });

            if (error) throw new Error(authErrorMessage(error, 'Login failed'));

            const user = await refreshSession();

            // Upload any guest lists before navigating so the account lands with them.
            await migrateAfterAuth(user);

            logger.info('Login successful', { username: data.username });

            navigate(redirectTarget(location.state?.from), { replace: true });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            logger.warn('Login failed', { username: data.username, error: errorMessage });
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
