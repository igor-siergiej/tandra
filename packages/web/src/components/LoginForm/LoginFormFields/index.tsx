import { useId } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import type { LoginFormData } from '../../../hooks/useLoginForm';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface LoginFormFieldsProps {
    register: UseFormRegister<LoginFormData>;
    errors: FieldErrors<LoginFormData>;
    isSubmitting: boolean;
}

export const LoginFormFields = ({ register, errors, isSubmitting }: LoginFormFieldsProps) => {
    const usernameId = useId();
    const passwordId = useId();

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-3">
                <Label htmlFor={usernameId}>Username</Label>
                <Input
                    id={usernameId}
                    type="text"
                    placeholder="Enter your username"
                    purpose="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    {...register('username')}
                    aria-invalid={errors.username ? 'true' : 'false'}
                    disabled={isSubmitting}
                />
                {errors.username && <p className="text-sm text-red-600">{errors.username.message}</p>}
            </div>

            <div className="grid gap-3">
                <div className="flex items-center">
                    <Label htmlFor={passwordId}>Password</Label>
                </div>
                <Input
                    id={passwordId}
                    type="password"
                    placeholder="Enter your password"
                    purpose="text"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    {...register('password')}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    disabled={isSubmitting}
                />
                {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>
        </div>
    );
};
