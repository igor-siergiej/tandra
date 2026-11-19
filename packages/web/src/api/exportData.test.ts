import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { downloadMyData } from './exportData';

const respond = (init: ResponseInit, body = '{}') =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, init));

describe('downloadMyData', () => {
    afterEach(() => vi.restoreAllMocks());

    it('saves the file under the name the server sent', async () => {
        respond({
            status: 200,
            headers: { 'Content-Disposition': 'attachment; filename="tandra-export-igor-2030-02-03.json"' },
        });

        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            expect(this.download).toBe('tandra-export-igor-2030-02-03.json');
        });

        await downloadMyData();

        expect(fetch).toHaveBeenCalledWith('/api/export');
        expect(click).toHaveBeenCalledOnce();
    });

    it('rejects, and saves nothing, when the export fails', async () => {
        respond({ status: 500 });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await expect(downloadMyData()).rejects.toThrow('Export request failed');
        expect(click).not.toHaveBeenCalled();
    });

    it('tells the app the session is gone on a 401', async () => {
        respond({ status: 401 });
        const expired = vi.fn();
        window.addEventListener('auth:session-expired', expired);

        await expect(downloadMyData()).rejects.toThrow();
        window.removeEventListener('auth:session-expired', expired);

        expect(expired).toHaveBeenCalledOnce();
    });
});
