import type { MongoDbConnection } from '@imapps/api-utils';
import type { Context } from 'hono';

import type { Collections } from '../dependencies/types';

/**
 * Hands a partial test double to code that expects the full dependency.
 *
 * `T` is taken from where the double is used (a constructor or function parameter), never from the double itself,
 * so `new RecipeService(fake(repo), ids)` checks every member the double does implement against `RecipeRepository`.
 */
export const fake = <T>(double: Partial<NoInfer<T>>): T => {
    // SAFETY: a test double implements only the members the code under test calls. Calling any other member throws
    // "is not a function" and fails the test, which is the signal a missing member should give.
    return double as T;
};

/** The value a lookup found; a missing one fails the test with `what` in the message instead of a later TypeError. */
export const present = <T>(value: T | null | undefined, what = 'value'): T => {
    if (value === null || value === undefined) throw new Error(`expected a ${what}, found none`);

    return value;
};

/**
 * A Mongo connection whose every collection is `collection`, for repository tests that drive one collection double.
 * The double implements only the driver calls the repository under test makes. `opened` records each collection name.
 */
export const connectionTo = <C>(collection: C, opened: string[] = []): MongoDbConnection<Collections> =>
    fake({
        getCollection: (name) => {
            opened.push(name);

            // SAFETY: the repository under test only calls the collection methods the double implements; any other
            // call throws "is not a function" and fails the test.
            return collection as never;
        },
    });

/**
 * Hands a hand-built Hono context to a handler a test calls directly. Unlike `fake`, the stub is not checked against
 * `Context`: Hono's request accessors are overloaded generics that no plain function satisfies, so a typed partial
 * cannot be written. Prefer driving a real `Hono` app with `app.request` where a test can.
 */
export const handlerContext = <C extends Context, Stub extends object = object>(stub: Stub): C => {
    // SAFETY: each handler test's stub implements every request accessor and response helper its handlers call; any
    // other member is missing and throws "is not a function", failing the test.
    return stub as never;
};
