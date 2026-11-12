import { logger } from '../../utils/logger';
import type { MakeRequestProps } from '../types';

const buildUrl = (pathname: string, queryParams?: Record<string, string>) =>
    queryParams ? `${pathname}?${new URLSearchParams(queryParams).toString()}` : pathname;

// Parse error message from response, handling both ok and error responses
const parseErrorMessage = async (response: Response): Promise<string> => {
    let errorMessage = response.statusText;

    try {
        const errorBody = await response.json();

        if (errorBody?.error) {
            errorMessage = errorBody.error;
        }
    } catch {
        // If parsing fails, use status text
    }

    return errorMessage;
};

// One request, then response/error mapping; splitting it would scatter the flow.
// fallow-ignore-next-line complexity
export const makeRequest = async ({
    pathname,
    method,
    operationString,
    body,
    queryParams,
    signal,
}: MakeRequestProps) => {
    try {
        // The session cookie is same-origin, so fetch attaches it without any header from us.
        const response = await fetch(buildUrl(pathname, queryParams), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body,
            signal,
        });

        if (response.status === 401) {
            // Better Auth slides the session on use, so a 401 means it is gone: no refresh to try.
            window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }

        if (response.ok) {
            if (response.status === 204) {
                return undefined;
            }

            return await response.json();
        }

        const errorMessage = await parseErrorMessage(response);

        if (response.status === 403 && errorMessage === 'username_required') {
            // Signed in through Google but no username picked yet: the app sends them to choose one.
            window.dispatchEvent(new CustomEvent('auth:username-required'));
        }

        logger.warn(`Request failed for ${operationString}`, {
            status: response.status,
            statusText: response.statusText,
        });
        throw Object.assign(new Error(errorMessage), { status: response.status });
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error(`Error while trying to ${operationString}`, {
                error: error.message,
            });
            throw error;
        }

        logger.error(`Error while trying to ${operationString}`, {
            error: 'Unknown error',
        });
        throw new Error(`Error while trying to ${operationString}`);
    }
};
