export function resolveMongoUri(): string {
    if (process.env.E2E_MONGO_URI) return process.env.E2E_MONGO_URI;

    if (process.env.CONNECTION_URI) {
        const url = new URL(process.env.CONNECTION_URI);
        url.pathname = '/';
        url.search = url.searchParams.get('authSource') ? `?authSource=${url.searchParams.get('authSource')}` : '';

        return url.toString();
    }

    return 'mongodb://localhost:27017/';
}
