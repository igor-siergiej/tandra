import type React from 'react';
import { useRouteError } from 'react-router-dom';
import { z } from 'zod';

import ErrorPage from '../ErrorPage';

// A router error is whatever was thrown: a string, or an object that at least has a message.
const routeErrorTextSchema = z.union([z.string(), z.object({ message: z.string() }).transform((e) => e.message)]);

const RouterErrorHandler: React.FC = () => {
    const error = useRouteError();

    let errorObject: Error;

    if (error instanceof Error) {
        errorObject = error;
    } else {
        const text = routeErrorTextSchema.safeParse(error);

        errorObject = new Error(text.success ? text.data : 'An unknown routing error occurred');
    }

    return <ErrorPage error={errorObject} />;
};

export default RouterErrorHandler;
