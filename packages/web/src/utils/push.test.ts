import { describe, expect, it } from 'vitest';

import { urlBase64ToUint8Array } from './push';

describe('urlBase64ToUint8Array', () => {
    it('decodes a standard base64url VAPID key to bytes', () => {
        const result = urlBase64ToUint8Array('SGVsbG8'); // "Hello"
        expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
    });

    it('handles base64url chars (- and _) and missing padding', () => {
        // bytes [255, 224] => base64 "/+A=" => base64url "_-A"
        const result = urlBase64ToUint8Array('_-A');
        expect(Array.from(result)).toEqual([255, 224]);
    });
});
