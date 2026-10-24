import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useRegisterForm } from '../../hooks/useRegisterForm';
import { GoogleButton } from '../GoogleButton';
import { PrivacyLink } from '../PrivacyLink';
import { RegisterFormFields } from './RegisterFormFields';

export function RegisterForm({ className, ...props }: React.ComponentProps<'div'>) {
    const { register, handleSubmit, errors, isSubmitting, onSubmit } = useRegisterForm();

    return (
        <div className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Card className="pt-4">
                <CardHeader>
                    <CardTitle>Create your account</CardTitle>
                    <CardDescription>Enter your details below to create your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="flex flex-col gap-6">
                            <RegisterFormFields register={register} errors={errors} isSubmitting={isSubmitting} />

                            {errors.root && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                                    {errors.root.message}
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                                </Button>
                                <GoogleButton />
                            </div>
                        </div>

                        <div className="mt-4 text-center text-sm">
                            Already have an account?{' '}
                            <a href="/login" className="underline underline-offset-4">
                                Sign in
                            </a>
                        </div>
                        <div className="mt-2 text-center">
                            <PrivacyLink />
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
