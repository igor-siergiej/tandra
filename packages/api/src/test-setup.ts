process.env.PORT = '3000';

process.env.CONNECTION_URI = 'mongodb://localhost:27017/test';

process.env.DATABASE_NAME = 'test';

process.env.BUCKET_NAME = 'test';

process.env.BUCKET_ACCESS_KEY = 'test';

process.env.BUCKET_SECRET_KEY = 'test';

process.env.BUCKET_ENDPOINT = 'localhost:9000';

process.env.FAL_KEY = 'test-key';

// Required for `config.get('betterAuthSecret')` and `'betterAuthUrl')` to resolve during the DI
// singleton factories at boot. Tests that exercise Better Auth construct their own `createAuth`
// with their own secret/baseURL; the api itself never resolves DependencyToken.Auth without these.
process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-123';

process.env.BETTER_AUTH_URL = 'http://localhost:3000';
