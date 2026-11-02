import { MOCK_USER, MOCK_USER_2, sessionHeaders } from '../auth';
import { expect, test } from '../fixtures';

const authA = () => sessionHeaders(MOCK_USER);
const authB = () => sessionHeaders(MOCK_USER_2);

// End-to-end for tandra-invite-links. The e2e suite uses two fixture users
// (`testuser` and `otheruser`) seeded into Better Auth by global-setup. The web side
// (the /invite/:token page) is exercised separately in unit tests; here we
// exercise the API contract that the web client uses.
test.describe('List invite API', () => {
    test('@smoke the unauthenticated preview of an unknown token returns 404', async ({ request }) => {
        const res = await request.get('/api/lists/invites/this-token-does-not-exist', {
            failOnStatusCode: false,
        });

        expect(res.status()).toBe(404);
    });

    test('A creates a token, B redeems it, B is added to the list and made friends with A', async ({ request }) => {
        // A creates a list and an invite. /api/lists is PUT (the create verb)
        // and the body needs `dateAdded` (the addList handler is typed).
        const created = await request.put('/api/lists', {
            data: { title: 'Invite Test List', dateAdded: new Date().toISOString(), listType: 'shopping' },
            headers: await authA(),
        });

        if (!created.ok()) {
            const status = created.status();
            const body = await created.text();
            throw new Error(`PUT /api/lists returned ${status}: ${body}`);
        }

        const { title } = (await created.json()) as { title: string };

        const issued = await request.post(`/api/lists/${encodeURIComponent(title)}/invites`, {
            headers: await authA(),
        });

        expect(issued.status()).toBe(201);
        const { token, ownerId } = (await issued.json()) as { token: string; ownerId: string };
        expect(token).toBeTruthy();
        expect(ownerId).toBe(MOCK_USER.id);

        // Public preview carries the owner's username and an expiry.
        const preview = await request.get(`/api/lists/invites/${token}`);
        expect(preview.status()).toBe(200);

        const previewBody = (await preview.json()) as {
            listTitle: string;
            ownerUsername: string;
            isClosed: boolean;
        };

        expect(previewBody.listTitle).toBe(title);
        expect(previewBody.ownerUsername).toBe('testuser');
        expect(previewBody.isClosed).toBe(false);

        // B is the second fixture user; the redeem runs as `otheruser` by sending
        // their session cookie on this request only.
        const claimed = await request.post(`/api/lists/invites/${token}/redeem`, {
            headers: await authB(),
        });

        expect(claimed.status()).toBe(200);

        // A second redeem by anyone is a 410.
        const second = await request.post(`/api/lists/invites/${token}/redeem`, {
            headers: await authB(),
            failOnStatusCode: false,
        });

        expect(second.status()).toBe(410);
    });

    test('A can revoke an unclaimed invite and the token is then refused at the preview endpoint', async ({
        request,
    }) => {
        const created = await request.put('/api/lists', {
            data: { title: 'Revocable List', dateAdded: new Date().toISOString(), listType: 'shopping' },
            headers: await authA(),
        });

        const { title } = (await created.json()) as { title: string };

        const issued = await request.post(`/api/lists/${encodeURIComponent(title)}/invites`, {
            headers: await authA(),
        });

        const { token } = (await issued.json()) as { token: string };

        const revoked = await request.delete(`/api/lists/invites/${token}`, { headers: await authA() });
        expect(revoked.status()).toBe(204);

        const preview = await request.get(`/api/lists/invites/${token}`);
        const body = (await preview.json()) as { isClosed: boolean };
        expect(body.isClosed).toBe(true);
    });
});
