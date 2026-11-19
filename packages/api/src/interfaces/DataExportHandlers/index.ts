import { dependencyContainer } from '../../dependencies/container';
import { DependencyToken } from '../../dependencies/types';
import { withAuth } from '../handlerUtils';

/** `tandra-export-<username>-<YYYY-MM-DD>.json`, with anything a header or a file system would choke on replaced. */
const exportFilename = (username: string, exportedAt: string): string =>
    `tandra-export-${username.replace(/[^A-Za-z0-9._-]/g, '_')}-${exportedAt.slice(0, 10)}.json`;

export const exportMyData = withAuth(async (c, user) => {
    const data = await dependencyContainer.resolve(DependencyToken.DataExportService).exportFor(user);

    c.header('Content-Disposition', `attachment; filename="${exportFilename(user.username, data.meta.exportedAt)}"`);
    // Personal data: never let a shared cache or the browser's back/forward cache keep a copy.
    c.header('Cache-Control', 'no-store');

    return c.json(data, 200);
});
