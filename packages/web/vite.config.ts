import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { type Connect, configDefaults, defineConfig, type Plugin } from 'vite-plus';

// Build configuration reads best as one function.
// fallow-ignore-next-line complexity
export default defineConfig(({ mode }) => {
    const isDev = mode === 'development';
    // Vitest runs this config in 'test' mode: no PWA plugin or dev-server mirrors, fixed build-time constants.
    const isTest = mode === 'test';

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
        plugins: isTest
            ? [react()]
            : [
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
                    manualChunks: vendorChunk,
                },
            },
            chunkSizeWarningLimit: 1000,
            commonjsOptions: {
                include: [/node_modules/],
            },
        },
        define: isTest
            ? {
                  __APP_VERSION__: JSON.stringify('test'),
                  // Matches the newest release in the Appbar test's mocked release notes.
                  __LATEST_RELEASE__: JSON.stringify('1.3.0'),
              }
            : {
                  __APP_VERSION__: JSON.stringify(appVersion),
                  __LATEST_RELEASE__: JSON.stringify(latestRelease),
                  __IS_PROD__: JSON.stringify(!isDev),
              },
        resolve: {
            alias: {
                '@': path.resolve(import.meta.dirname, './src'),
                ...(isTest
                    ? {
                          'virtual:pwa-register/react': path.resolve(
                              import.meta.dirname,
                              './src/__mocks__/pwa-register.ts'
                          ),
                      }
                    : {}),
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
                    // e2e runs one api per Playwright worker and points each web server at its own.
                    target: process.env.E2E_API_PROXY_TARGET ?? 'http://localhost:4001',
                    changeOrigin: false,
                    secure: false,
                    ws: true,
                },
            },
        },
        test: {
            globals: true,
            environment: 'happy-dom',
            setupFiles: ['./src/test-setup.ts'],
            exclude: [...configDefaults.exclude, 'build/**', 'build-e2e/**'],
            // Worker threads start faster than the default child processes; ~10-15% off a full run, same results.
            pool: 'threads',
            // date-fns ships hundreds of separate ESM files; Vite pre-bundles it for the app, but Vitest
            // otherwise loads each one, ~2s per test file that reaches it. Pre-bundling makes that one file.
            deps: { optimizer: { client: { enabled: true, include: ['date-fns'] } } },
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html'],
                exclude: ['node_modules/', 'build/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
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

// Rolldown (Vite 8) only takes the function form of manualChunks.
const VENDOR_CHUNKS: Record<string, string[]> = {
    'react-vendor': ['react', 'react-dom', 'scheduler'],
    'router-vendor': ['react-router-dom', 'react-router', 'cookie', 'set-cookie-parser'],
    'query-vendor': ['@tanstack/react-query'],
    'ui-vendor': ['lucide-react', 'motion', 'framer-motion', 'motion-dom', 'motion-utils'],
    'utils-vendor': ['clsx', 'tailwind-merge'],
};

function vendorChunk(id: string): string | undefined {
    const match = id.match(/node_modules\/(?:\.bun\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\//);

    if (!match) return undefined;

    return Object.keys(VENDOR_CHUNKS).find((chunk) => VENDOR_CHUNKS[chunk].includes(match[1]));
}
