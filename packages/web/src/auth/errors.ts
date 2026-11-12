// Better Auth answers failed sign-ins and sign-ups with `{ code, message, status }`; these are the
// ones a person can act on, in the app's own words.
const MESSAGES: Record<string, string> = {
    INVALID_USERNAME_OR_PASSWORD: 'Invalid username or password',
    USERNAME_IS_ALREADY_TAKEN: 'That username is taken',
    USERNAME_TOO_SHORT: 'Username must be at least 3 characters',
    USERNAME_TOO_LONG: 'Username must not exceed 50 characters',
    INVALID_USERNAME: 'Usernames may only use letters, numbers, _ and .',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
};

export interface AuthClientError {
    code?: string;
    message?: string;
    status?: number;
}

// Rate limit first, then a known code, then the server's own words, then the caller's fallback.
// fallow-ignore-next-line complexity
export const authErrorMessage = (error: AuthClientError, fallback: string): string => {
    if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';

    return (error.code && MESSAGES[error.code]) || error.message || fallback;
};

// Better Auth sends a failed Google round trip back to the app as `?error=<code>`.
const OAUTH_MESSAGES: Record<string, string> = {
    access_denied: 'Google sign-in was cancelled.',
    account_not_linked:
        'That Google account matches an existing account. Sign in with your username, then link Google in Settings.',
    account_already_linked_to_different_user: 'That Google account is already used by another Tandra account.',
    state_mismatch: 'Google sign-in took too long. Please try again.',
    please_restart_the_process: 'Google sign-in took too long. Please try again.',
};

/** Readable text for an OAuth callback `?error=` code; unknown codes get `fallback`. */
export const oauthErrorMessage = (code: string, fallback: string): string =>
    Object.hasOwn(OAUTH_MESSAGES, code) ? OAUTH_MESSAGES[code] : fallback;
