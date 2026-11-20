import { expect, it } from 'bun:test';

import { logErrorFields } from './logError';

it.each([
    new Error('private-item-name'),
    Object.assign(new Error('private-recipe-title'), {
        name: 'private-ingredient',
        code: 'private-transcript',
        document: { instructions: 'private-instruction' },
        cause: new Error('private-list-title'),
    }),
    { message: 'private-item-name', name: 'TypeError', code: 'private-recipe-title' },
    'private-transcript',
    null,
    undefined,
])('keeps free text, custom fields and nested causes out of diagnostics (%#)', (error) => {
    expect(JSON.stringify(logErrorFields(error))).not.toContain('private-');
});

it('retains a known error class and numeric database code without serializing the error', () => {
    const error = Object.assign(new Error('private-recipe-title'), { name: 'MongoServerError', code: 121 });
    expect(logErrorFields(error)).toEqual({ errorName: 'MongoServerError', errorCode: 121 });
});
