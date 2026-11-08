import { Navigate } from 'react-router-dom';

import { useAuth } from '../../auth';
import { LoginForm } from '../../components/LoginForm';

const LoginPage = () => {
    const { isAuthenticated } = useAuth();

    // Already signed in (e.g. a Google sign-in finished while this page was open): go to the app.
    if (isAuthenticated) return <Navigate to="/" replace />;

    return <LoginForm />;
};

export default LoginPage;
