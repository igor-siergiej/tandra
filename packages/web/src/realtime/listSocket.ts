import { z } from 'zod';

import { caughtErrorSchema } from '../utils/caughtError';

export interface Viewer {
    id: string;
    username: string;
}

const serverMessageSchema = z
    .object({
        type: z.enum(['changed', 'presence']).optional().catch(undefined),
        users: z
            .array(z.object({ id: z.string(), username: z.string() }))
            .optional()
            .catch(undefined),
    })
    .catch({});

type ServerMessage = z.output<typeof serverMessageSchema>;

interface ListSocketOptions {
    listTitle: string;
    getTicket: (listTitle: string) => Promise<string>;
    onChanged: () => void;
    onPresence: (viewers: Viewer[]) => void;
    // Injected for tests.
    createSocket?: (url: string) => WebSocket;
    random?: () => number;
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** Sent by the API when the user is no longer a member of the list: reconnecting is pointless. */
const CLOSE_REMOVED = 4403;

/** Ticket request answers that mean "this user may not watch this list"; retrying cannot help. */
const FORBIDDEN_STATUSES = new Set([403, 404]);

const socketUrl = (listTitle: string, ticket: string) => {
    const origin = window.location.origin.replace(/^http/, 'ws');

    return `${origin}/api/ws/lists/${encodeURIComponent(listTitle)}?ticket=${encodeURIComponent(ticket)}`;
};

const parse = (data: string): Partial<ServerMessage> => {
    try {
        return serverMessageSchema.parse(JSON.parse(data));
    } catch {
        return {};
    }
};

const isForbidden = (cause: unknown) => FORBIDDEN_STATUSES.has(caughtErrorSchema.parse(cause).status ?? 0);

class ListSocketConnection {
    private socket: WebSocket | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | undefined;
    private failures = 0;
    private disposed = false;

    constructor(private readonly options: Required<ListSocketOptions>) {
        window.addEventListener('online', this.reconnectNow);
        document.addEventListener('visibilitychange', this.onVisible);
        void this.connect();
    }

    close = () => {
        this.disposed = true;
        clearTimeout(this.retryTimer);
        window.removeEventListener('online', this.reconnectNow);
        document.removeEventListener('visibilitychange', this.onVisible);
        this.socket?.close();
        this.socket = null;
    };

    private onVisible = () => {
        if (document.visibilityState === 'visible') this.reconnectNow();
    };

    private reconnectNow = () => {
        if (!this.idle) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
        this.failures = 0;
        void this.connect();
    };

    private scheduleReconnect() {
        if (this.disposed || this.retryTimer !== undefined) return;
        const delay = Math.min(BASE_DELAY_MS * 2 ** this.failures, MAX_DELAY_MS);
        this.failures++;
        this.retryTimer = setTimeout(
            () => {
                this.retryTimer = undefined;
                void this.connect();
            },
            delay / 2 + (this.options.random() * delay) / 2
        );
    }

    private get idle() {
        return !this.disposed && !this.socket;
    }

    private async connect() {
        if (!this.idle) return;

        const ticket = await this.options.getTicket(this.options.listTitle).catch((err) => {
            if (!isForbidden(err)) this.scheduleReconnect();

            return null;
        });

        if (ticket && !this.disposed) this.attach(this.options.createSocket(socketUrl(this.options.listTitle, ticket)));
    }

    private attach(socket: WebSocket) {
        this.socket = socket;
        // Refetch on every (re)open: anything that changed while disconnected was never pushed.
        socket.onopen = () => {
            this.failures = 0;
            this.options.onChanged();
        };

        socket.onmessage = (event) => this.handle(parse(String(event.data)));
        socket.onclose = (event) => {
            if (this.socket === socket) this.socket = null;
            this.options.onPresence([]);

            if (event.code !== CLOSE_REMOVED) this.scheduleReconnect();
        };
    }

    private handle(message: Partial<ServerMessage>) {
        if (message.type === 'changed') this.options.onChanged();

        if (message.type === 'presence') this.options.onPresence(message.users ?? []);
    }
}

/**
 * Keeps a websocket to one list open: pushes "changed" and presence to the callbacks and
 * reconnects with jittered exponential backoff. Returns a function that closes it for good.
 */
export const openListSocket = ({
    createSocket = (url) => new WebSocket(url),
    random = Math.random,
    ...rest
}: ListSocketOptions): (() => void) => new ListSocketConnection({ createSocket, random, ...rest }).close;
