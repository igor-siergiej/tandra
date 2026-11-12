import { describe, expect, it, vi } from 'bun:test';

import { assertPublicUrl, isPrivateIp, safeFetch } from './safeFetch';

const publicHost = async () => [{ address: '93.184.216.34' }];

describe('isPrivateIp', () => {
    it.each([
        '127.0.0.1',
        '10.1.2.3',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.68.54',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '::1',
        '::',
        'fd00::1',
        'fe80::1',
        '::ffff:127.0.0.1',
        '::ffff:c0a8:0101',
    ])('blocks %s', (ip) => {
        expect(isPrivateIp(ip)).toBe(true);
    });

    it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '100.128.0.1', '2606:2800:220:1:248:1893:25c8:1946'])(
        'allows %s',
        (ip) => {
            expect(isPrivateIp(ip)).toBe(false);
        }
    );
});

describe('assertPublicUrl', () => {
    it('rejects a loopback IP literal', async () => {
        await expect(assertPublicUrl('http://127.0.0.1/admin')).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a private IP literal', async () => {
        await expect(assertPublicUrl('http://192.168.1.10:9000/')).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a bracketed IPv6 loopback', async () => {
        await expect(assertPublicUrl('http://[::1]/')).rejects.toMatchObject({ status: 400 });
    });

    it('rejects a hostname that resolves to a private address', async () => {
        const resolve = async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }];
        await expect(assertPublicUrl('http://sneaky.example/', resolve)).rejects.toMatchObject({ status: 400 });
    });

    it('rejects non-http schemes', async () => {
        await expect(assertPublicUrl('file:///etc/passwd', publicHost)).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an unresolvable host', async () => {
        const fail = async () => {
            throw new Error('ENOTFOUND');
        };

        await expect(assertPublicUrl('http://nope.invalid/', fail)).rejects.toMatchObject({ status: 400 });
    });

    it('accepts a public host', async () => {
        await expect(assertPublicUrl('https://example.com/recipe', publicHost)).resolves.toBeUndefined();
    });
});

describe('safeFetch', () => {
    it('returns a normal public response', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(new Response('ok'));

        const response = await safeFetch('https://example.com/r', {}, { resolveHost: publicHost, fetchImpl });

        expect(await response.text()).toBe('ok');
        expect(fetchImpl).toHaveBeenCalledWith('https://example.com/r', { redirect: 'manual' });
    });

    it('follows a redirect to another public URL', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/final' } }))
            .mockResolvedValueOnce(new Response('done'));

        const response = await safeFetch('https://example.com/start', {}, { resolveHost: publicHost, fetchImpl });

        expect(await response.text()).toBe('done');
        expect(fetchImpl.mock.calls[1][0]).toBe('https://example.com/final');
    });

    it('blocks a redirect to a private IP without requesting it', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(null, { status: 301, headers: { location: 'http://192.168.68.54:7000/bucket' } })
            );

        await expect(
            safeFetch('https://example.com/start', {}, { resolveHost: publicHost, fetchImpl })
        ).rejects.toMatchObject({ status: 400 });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('gives up after too many redirects', async () => {
        const fetchImpl = vi
            .fn()
            .mockImplementation(async () => new Response(null, { status: 302, headers: { location: '/loop' } }));

        await expect(
            safeFetch('https://example.com/loop', {}, { resolveHost: publicHost, fetchImpl })
        ).rejects.toMatchObject({ status: 502 });
    });

    it('never calls fetch for a private target', async () => {
        const fetchImpl = vi.fn();

        await expect(safeFetch('http://127.0.0.1/', {}, { fetchImpl })).rejects.toMatchObject({ status: 400 });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
