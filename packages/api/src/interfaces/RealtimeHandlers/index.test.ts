import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { Hono } from 'hono';

import { ListRealtimeHub } from '../../domain/ListRealtimeHub';
import { WsTicketStore } from '../../domain/WsTicketStore';
import { websocket } from '../../infrastructure/bunWebSocket';
import { notifyListChanged } from '../../middleware/notifyListChanged';
import { createRealtimeHandlers } from './index';

const hub = new ListRealtimeHub();
const tickets = new WsTicketStore();
const listService = { getList: vi.fn() };

const { issueListSocketTicket, connectListSocket } = createRealtimeHandlers({
    hub,
    tickets,
    getList: (title) => listService.getList(title),
});

const ALICE = { id: 'u-alice', username: 'alice' };
const BOB = { id: 'u-bob', username: 'bob' };
const MALLORY = { id: 'u-mallory', username: 'mallory' };

const LISTS: Record<string, { id: string; users: Array<{ id: string; username: string }> }> = {
    Groceries: { id: 'list-groceries', users: [ALICE, BOB] },
    Private: { id: 'list-private', users: [ALICE] },
};

const GROCERIES_ID = LISTS.Groceries.id;

// Lists resolve by id or by (legacy) title, as ListService.getList does.
const findList = (ref: string) => Object.values(LISTS).find((list) => list.id === ref) ?? LISTS[ref];

// Stands in for `authenticate`: the bearer token IS the user id, resolved from a fixed directory.
const USERS: Record<string, typeof ALICE> = { alice: ALICE, bob: BOB, mallory: MALLORY };

const fakeAuth = async (c: any, next: any) => {
    const user = USERS[(c.req.header('authorization') ?? '').replace('Bearer ', '')];

    if (!user) return c.json({ error: 'Invalid or expired token' }, 401);
    c.set('user', user);
    await next();
};

// Plain HTTP calls go through app.request: other suites replace globalThis.fetch and never restore it.
const app = new Hono();
let server: ReturnType<typeof Bun.serve>;
let base: string;

beforeAll(() => {
    app.post('/api/lists/:title/socket-ticket', fakeAuth, issueListSocketTicket);
    app.get('/api/ws/lists/:title', connectListSocket);
    const resolveListId = async (ref: string) => findList(ref)?.id;
    app.post('/api/lists/:title/items', fakeAuth, notifyListChanged(hub, resolveListId), (c) =>
        c.json({ ok: true }, c.req.query('fail') ? 500 : 200)
    );
    server = Bun.serve({ port: 0, fetch: app.fetch, websocket });
    base = `localhost:${server.port}`;
});

afterAll(() => server.stop(true));

beforeEach(() => {
    listService.getList.mockImplementation(async (title: string) => {
        const list = findList(title);

        if (!list) throw new Error('not found');

        return list;
    });
});

const getTicket = async (token: string, title: string) => {
    const res = await app.request(`/api/lists/${title}/socket-ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });

    return { status: res.status, ticket: res.ok ? ((await res.json()) as { ticket: string }).ticket : undefined };
};

type Message = { type: string; users?: Array<{ id: string }> };

// Opens a socket and exposes everything it receives; resolves once the upgrade succeeds.
const connect = (title: string, ticket: string | undefined) =>
    new Promise<{ socket: WebSocket; messages: Message[]; closed: Promise<number> } | { rejected: true }>((resolve) => {
        const socket = new WebSocket(`ws://${base}/api/ws/lists/${title}${ticket ? `?ticket=${ticket}` : ''}`);
        const messages: Message[] = [];
        const closed = new Promise<number>((done) => socket.addEventListener('close', (e) => done(e.code)));
        socket.addEventListener('message', (e) => messages.push(JSON.parse(String(e.data))));
        socket.addEventListener('open', () => resolve({ socket, messages, closed }));
        socket.addEventListener('error', () => resolve({ rejected: true }));
    });

const until = async (predicate: () => boolean) => {
    for (let i = 0; i < 100 && !predicate(); i++) await Bun.sleep(10);
    expect(predicate()).toBe(true);
};

describe('list socket tickets', () => {
    it('refuses a ticket to someone who is not a member of the list', async () => {
        expect((await getTicket('bob', 'Private')).status).toBe(403);
        expect((await getTicket('mallory', 'Groceries')).status).toBe(403);
    });

    it('issues tickets for a list referenced by id as well as by title', async () => {
        expect((await getTicket('alice', GROCERIES_ID)).status).toBe(200);
        expect((await getTicket('alice', 'Groceries')).status).toBe(200);
    });

    it('refuses a ticket for an invalid or expired access token', async () => {
        expect((await getTicket('expired-token', 'Groceries')).status).toBe(401);
    });
});

describe('list websocket', () => {
    it('rejects a connection without a ticket or with an unknown ticket', async () => {
        expect(await connect('Groceries', undefined)).toEqual({ rejected: true });
        expect(await connect('Groceries', 'not-a-real-ticket')).toEqual({ rejected: true });
    });

    it("rejects a ticket that was issued for a different list, and doesn't let it be reused", async () => {
        const { ticket } = await getTicket('alice', 'Groceries');
        expect(await connect('Private', ticket)).toEqual({ rejected: true });
        // Redemption consumes the ticket even when it was presented for the wrong list.
        expect(await connect('Groceries', ticket)).toEqual({ rejected: true });
    });

    it('rejects a ticket once its holder has been removed from the list', async () => {
        const { ticket } = await getTicket('bob', 'Groceries');
        LISTS.Groceries.users = [ALICE];

        try {
            expect(await connect('Groceries', ticket)).toEqual({ rejected: true });
        } finally {
            LISTS.Groceries.users = [ALICE, BOB];
        }
    });

    it('tells members who else has the list open, and updates when they leave', async () => {
        const a = await connect('Groceries', (await getTicket('alice', 'Groceries')).ticket);

        if ('rejected' in a) throw new Error('alice was rejected');
        await until(() => a.messages.some((m) => m.type === 'presence' && m.users?.length === 1));

        const b = await connect('Groceries', (await getTicket('bob', 'Groceries')).ticket);

        if ('rejected' in b) throw new Error('bob was rejected');
        await until(() => a.messages.some((m) => m.type === 'presence' && m.users?.length === 2));
        await until(() => b.messages.some((m) => m.type === 'presence' && m.users?.length === 2));

        b.socket.close();
        await until(() => a.messages.at(-1)?.type === 'presence' && a.messages.at(-1)?.users?.length === 1);
        a.socket.close();
    });

    it('puts a socket opened by title and one opened by id in the same room', async () => {
        const byTitle = await connect('Groceries', (await getTicket('alice', 'Groceries')).ticket);

        if ('rejected' in byTitle) throw new Error('alice was rejected');
        const byId = await connect(GROCERIES_ID, (await getTicket('bob', GROCERIES_ID)).ticket);

        if ('rejected' in byId) throw new Error('bob was rejected');

        await until(() => byTitle.messages.some((m) => m.type === 'presence' && m.users?.length === 2));

        await app.request('/api/lists/Groceries/items', { method: 'POST', headers: { Authorization: 'Bearer bob' } });
        await until(() => byId.messages.some((m) => m.type === 'changed'));
        byTitle.socket.close();
        byId.socket.close();
    });

    it('does not leak events from a list the socket did not subscribe to', async () => {
        const a = await connect('Groceries', (await getTicket('alice', 'Groceries')).ticket);

        if ('rejected' in a) throw new Error('alice was rejected');
        await until(() => a.messages.length > 0);
        const before = a.messages.length;

        hub.notifyChanged(LISTS.Private.id);
        await Bun.sleep(50);
        expect(a.messages.length).toBe(before);
        a.socket.close();
    });
});

describe('notifyListChanged', () => {
    it('broadcasts after a successful mutation but not after a failed one', async () => {
        const a = await connect('Groceries', (await getTicket('alice', 'Groceries')).ticket);

        if ('rejected' in a) throw new Error('alice was rejected');
        await until(() => a.messages.length > 0);

        await app.request(`/api/lists/Groceries/items?fail=1`, {
            method: 'POST',
            headers: { Authorization: 'Bearer bob' },
        });
        await Bun.sleep(50);
        expect(a.messages.some((m) => m.type === 'changed')).toBe(false);

        await app.request(`/api/lists/Groceries/items`, {
            method: 'POST',
            headers: { Authorization: 'Bearer bob' },
        });
        await until(() => a.messages.some((m) => m.type === 'changed'));
        a.socket.close();
    });

    it('closes the sockets of a removed member', async () => {
        const b = await connect('Groceries', (await getTicket('bob', 'Groceries')).ticket);

        if ('rejected' in b) throw new Error('bob was rejected');
        await until(() => b.messages.length > 0);

        hub.kick(GROCERIES_ID, BOB.id);
        expect(await b.closed).toBe(4403);
    });
});
