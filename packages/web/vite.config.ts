import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { type Connect, defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Build configuration reads best as one function.
// fallow-ignore-next-line complexity
export default defineConfig(({ mode }) => {
    const isDev = mode === 'development';

    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    // Dev server always shows a fixed 'localhost' badge instead of package.json's
    // version — keeps it visibly distinct from a real release and stops every
    // version bump from drifting e2e visual-regression baselines that run against
    // this same dev server. APP_VERSION (set by the Docker build) still wins for
    // real builds regardless of mode.
    const appVersion = process.env.APP_VERSION || (isDev ? 'localhost' : packageJson.version) || '';

    // The newest release version is all the app shell needs (for the unread dot); the notes themselves are loaded
    // only when the panel opens.
    const releaseNotes = JSON.parse(fs.readFileSync('./src/data/release-notes.json', 'utf8')) as Array<{
        version: string;
    }>;
    const latestRelease = releaseNotes[0]?.version ?? '';

    return {
        plugins: [
            react(),
            // Mirror the nginx `location = /sitemap.xml { return 404; }` rule
            // (and its siblings) for the dev and preview servers, so an e2e
            // request to /sitemap.xml sees the same 404 the production container
            // serves. Without this, Vite's SPA history fallback returns 200 +
            // index.html and the test only "passes" against the live build.
            spaNotFoundMirror(['/sitemap.xml', '/favicon.ico', '/apple-touch-icon.png']),
            // Set text/plain on /robots.txt the same way nginx does in prod.
            robotsTxtMirror(),
            VitePWA({
                strategies: 'injectManifest',
                srcDir: 'src',
                filename: 'sw.ts',
                registerType: 'prompt',
                injectRegister: 'auto',
                selfDestroying: false,
                injectManifest: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
                },
                manifest: {
                    name: 'Tandra',
                    short_name: 'Tandra',
                    description: 'Shopping list application',
                    start_url: '/',
                    display: 'standalone',
                    background_color: '#f7f1e7',
                    theme_color: '#2e7d32',
                    scope: '/',
                    orientation: 'portrait-primary',
                    categories: ['shopping', 'productivity', 'lifestyle'],
                    share_target: {
                        action: '/share',
                        method: 'GET',
                        params: {
                            url: 'url',
                            title: 'title',
                            text: 'text',
                        },
                    },
                    icons: [
                        {
                            src: 'logo-192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'any maskable',
                        },
                        {
                            src: 'logo-512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any maskable',
                        },
                    ],
                },
                devOptions: {
                    enabled: true,
                    type: 'module',
                },
            }),
        ],
        build: {
            outDir: './build',
            rollupOptions: {
                output: {
                    manualChunks: {
                        'react-vendor': ['react', 'react-dom'],
                        'router-vendor': ['react-router-dom'],
                        'query-vendor': ['@tanstack/react-query'],
                        'ui-vendor': ['lucide-react', 'motion'],
                        'utils-vendor': ['clsx', 'tailwind-merge'],
                    },
                },
            },
            chunkSizeWarningLimit: 1000,
            commonjsOptions: {
                include: [/node_modules/],
            },
        },
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
            __LATEST_RELEASE__: JSON.stringify(latestRelease),
            __IS_PROD__: JSON.stringify(!isDev),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 4000,
            host: true,
            allowedHosts: ['.ts.net'],
            hmr: {
                overlay: false,
            },
            proxy: {
                '/api': {
                    target: 'http://localhost:4001',
                    changeOrigin: false,
                    secure: false,
                    ws: true,
                },
            },
        },
    };
});

// Paths the production nginx config explicitly 404s instead of letting
// fall through to the SPA shell. The production `try_files $uri /index.html;`
// + `error_page 404 /index.html;` would otherwise return index.html with a
// 200; the dev and preview servers do the same by default. Both return the
// same result (the SPA renders) — which is wrong for these paths — so the
// mirror sits *before* Vite's SPA fallback middleware and short-circuits them.
function spaNotFoundMirror(paths: string[]): Plugin {
    const exact = new Set(paths);
    const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (exact.has(url) || url.startsWith('/.well-known/')) {
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain');
            res.end('Not Found');
            return;
        }
        next();
    };
    return {
        name: 'spa-not-found-mirror',
        // Run before Vite's built-in SPA fallback.
        configureServer: (server) => {
            server.middlewares.use(middleware);
        },
        configurePreviewServer: (server) => {
            server.middlewares.use(middleware);
        },
    };
}

// Run before Vite serves /robots.txt itself so the content-type and exact
// bytes match the production container (which is what crawlers and the e2e
// parse). The dev server would otherwise serve the copied public/robots.txt
// as text/html.
function robotsTxtMirror(): Plugin {
    const middleware: Connect.NextHandleFunction = (req, res, next) => {
        if (req.url && req.url.split('?')[0] === '/robots.txt') {
            res.statusCode = 200;
            res.setHeader('content-type', 'text/plain');
            res.end('User-agent: *\nDisallow: /\n');
            return;
        }
        next();
    };
    return {
        name: 'robots-txt-mirror',
        configureServer: (server) => {
            server.middlewares.use(middleware);
        },
        configurePreviewServer: (server) => {
            server.middlewares.use(middleware);
        },
    };
}
