import { describe, expect, it } from 'vite-plus/test';

import { returningUserCookie } from './returningUserCookie';

describe('returningUserCookie', () => {
    it('scopes the cookie to tandra.uk from the app host, so the landing site can read it', () => {
        expect(returningUserCookie('app.tandra.uk')).toBe(
            'tandra_app=1; Domain=tandra.uk; Path=/; Max-Age=31536000; Secure; SameSite=Lax'
        );
    });

    it.each(['localhost', 'tandra.uk', 'www.tandra.uk', 'tandra.example.com'])('sets nothing on %s', (host) => {
        expect(returningUserCookie(host)).toBeNull();
    });
});
