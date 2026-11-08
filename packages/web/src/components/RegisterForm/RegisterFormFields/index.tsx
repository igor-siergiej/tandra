import { useId } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import type { RegisterFormData } from '../../../hooks/useRegisterForm';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface RegisterFormFieldsProps {
    register: UseFormRegister<RegisterFormData>;
    errors: FieldErrors<RegisterFormData>;
    isSubmitting: boolean;
}

export const RegisterFormFields = ({ register, errors, isSubmitting }: RegisterFormFieldsProps) => {
    const usernameId = useId();
    const passwordId = useId();
    const repeatPasswordId = useId();

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
                <Label htmlFor={passwordId}>Password</Label>
                <Input
                    id={passwordId}
                    type="password"
                    placeholder="Enter your password"
                    purpose="text"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    {...register('password')}
                    aria-invalid={errors.password ? 'true' : 'false'}
                />
                {errors.password ? (
                    <p className="text-sm text-red-600">{errors.password.message}</p>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        At least 8 characters, letters and digits only, must include both letters and a number.
                    </p>
                )}
            </div>

            <div className="grid gap-3">
                <Label htmlFor={repeatPasswordId}>Repeat Password</Label>
                <Input
                    id={repeatPasswordId}
                    type="password"
                    placeholder="Repeat your password"
                    purpose="text"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    {...register('repeatPassword')}
                    aria-invalid={errors.repeatPassword ? 'true' : 'false'}
                    disabled={isSubmitting}
                />
                {errors.repeatPassword && <p className="text-sm text-red-600">{errors.repeatPassword.message}</p>}
            </div>
        </div>
    );
};
