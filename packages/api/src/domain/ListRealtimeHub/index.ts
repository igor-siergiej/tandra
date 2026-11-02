export interface ListSocket {
    send(data: string): unknown;
    close(code?: number, reason?: string): unknown;
}

export interface PresenceUser {
    id: string;
    username: string;
}

type ServerMessage = { type: 'changed' } | { type: 'presence'; users: PresenceUser[] };

/**
 * In-memory fan-out of "this list changed" and "who has this list open" to websocket
 * subscribers. Deliberately process-local: the API runs as one container, so there is
 * no cross-replica pub/sub. Events carry no state; clients refetch the list.
 */
export class ListRealtimeHub {
    private readonly rooms = new Map<string, Map<ListSocket, PresenceUser>>();

    join(listTitle: string, user: PresenceUser, socket: ListSocket): void {
        const room = this.rooms.get(listTitle) ?? new Map<ListSocket, PresenceUser>();
        room.set(socket, user);
        this.rooms.set(listTitle, room);
        this.broadcastPresence(listTitle);
    }

    leave(listTitle: string, socket: ListSocket): void {
        const room = this.rooms.get(listTitle);

        if (!room?.delete(socket)) return;

        if (room.size === 0) {
            this.rooms.delete(listTitle);

            return;
        }

        this.broadcastPresence(listTitle);
    }

    notifyChanged(listTitle: string): void {
        this.broadcast(listTitle, { type: 'changed' });
    }

    /**
     * Close every connection a user has on a list, e.g. after they were removed from it.
     * Called from the route layer through the DI-resolved hub, which fallow cannot trace.
     */
    // fallow-ignore-next-line unused-class-member
    kick(listTitle: string, userId: string): void {
        const room = this.rooms.get(listTitle);

        if (!room) return;

        for (const [socket, user] of [...room]) {
            if (user.id !== userId) continue;
            this.leave(listTitle, socket);
            socket.close(4403, 'Removed from list');
        }
    }

    presence(listTitle: string): PresenceUser[] {
        const unique = new Map<string, PresenceUser>();

        for (const user of this.rooms.get(listTitle)?.values() ?? []) unique.set(user.id, user);

        return [...unique.values()];
    }

    private broadcastPresence(listTitle: string): void {
        this.broadcast(listTitle, { type: 'presence', users: this.presence(listTitle) });
    }

    private broadcast(listTitle: string, message: ServerMessage): void {
        const room = this.rooms.get(listTitle);

        if (!room) return;
        const data = JSON.stringify(message);

        for (const socket of [...room.keys()]) {
            try {
                socket.send(data);
            } catch {
                // A dead socket must not block the rest; its close handler will remove it.
            }
        }
    }
}
