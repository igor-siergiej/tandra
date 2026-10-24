import { Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { oauthErrorMessage } from '../../auth/errors';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useGuest } from '../../guest/GuestContext';
import { useLoginForm } from '../../hooks/useLoginForm';
import { GoogleButton } from '../GoogleButton';
import { PrivacyLink } from '../PrivacyLink';
import { LoginFormFields } from './LoginFormFields';

// Password form, Google, guest entry and the OAuth callback error in one card.
// fallow-ignore-next-line complexity
export const LoginForm: React.FC = () => {
    const { register, handleSubmit, errors, isSubmitting, onSubmit } = useLoginForm();
    const { enterGuestMode } = useGuest();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // A failed Google round trip lands back here with Better Auth's `?error=<code>`.
    const googleError = searchParams.get('error');
    const errorMessage =
        errors.root?.message ??
        (googleError && oauthErrorMessage(googleError, "Couldn't sign in with Google. Please try again."));

    const handleTryIt = () => {
        enterGuestMode('login_page');
        navigate('/');
    };

    return (
        <div className="flex flex-col gap-6">
            <Card className="pt-4">
                <CardHeader>
                    <CardTitle>Login to your account</CardTitle>
                    <CardDescription>Enter your username below to login to your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="flex flex-col gap-6">
                            <LoginFormFields register={register} errors={errors} isSubmitting={isSubmitting} />

                            {errorMessage && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{errorMessage}</div>
                            )}

                            <div className="flex flex-col gap-3">
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? 'Logging in...' : 'Login'}
                                </Button>
                                <GoogleButton />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full"
                                    onClick={handleTryIt}
                                    data-testid="try-it-button"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Try it without an account
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 text-center text-sm">
                            Don't have an account?{' '}
                            <a href="/register" className="underline underline-offset-4">
                                Sign up
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
};
