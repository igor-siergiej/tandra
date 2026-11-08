/**
 * Hands a partial test double to code that expects the full value: a hook's return, a service, a browser API.
 *
 * `T` is taken from where the double is used (a mock's return value, a parameter), never from the double itself, so
 * `vi.mocked(useFriends).mockReturnValue(fake({ friends: [] }))` checks every member the double does give.
 */
export const fake = <T>(double: Partial<NoInfer<T>>): T => {
    // SAFETY: a test double implements only the members the code under test reads. Reading any other member gives
    // undefined (or throws "is not a function"), which fails the test, the signal a missing member should give.
    return double as T;
};

/** The value a lookup found; a missing one fails the test with `what` in the message instead of a later TypeError. */
export const present = <T>(value: T | null | undefined, what = 'value'): T => {
    if (value === null || value === undefined) throw new Error(`expected a ${what}, found none`);

    return value;
};

/** `element` as the element type `kind` constructs (e.g. `HTMLInputElement`), failing the test if it is not one. */
export const narrowTo = <T extends Node>(element: Node | null | undefined, kind: abstract new () => T): T => {
    if (element instanceof kind) return element;

    throw new Error(`expected a ${kind.name}, found ${element?.nodeName ?? 'nothing'}`);
};
