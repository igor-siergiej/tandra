import { afterEach, describe, expect, it } from 'vite-plus/test';

import { installWebMcpOriginTrialToken } from './originTrial';

const metas = () => document.head.querySelectorAll('meta[http-equiv="origin-trial"]');

describe('installWebMcpOriginTrialToken', () => {
    afterEach(() => {
        for (const meta of metas()) meta.remove();
    });

    it('adds the token as an origin-trial meta tag in production', () => {
        expect(installWebMcpOriginTrialToken('tok123', true)).toBe(true);

        expect(metas()).toHaveLength(1);
        expect(metas()[0].getAttribute('content')).toBe('tok123');
    });

    it('adds nothing outside production', () => {
        expect(installWebMcpOriginTrialToken('tok123', false)).toBe(false);
        expect(metas()).toHaveLength(0);
    });

    it('adds nothing without a token', () => {
        expect(installWebMcpOriginTrialToken(undefined, true)).toBe(false);
        expect(installWebMcpOriginTrialToken('', true)).toBe(false);
        expect(metas()).toHaveLength(0);
    });

    it('does not add the same token twice', () => {
        installWebMcpOriginTrialToken('tok123', true);

        expect(installWebMcpOriginTrialToken('tok123', true)).toBe(false);
        expect(metas()).toHaveLength(1);
    });
});
