/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

/** Newest version in data/release-notes.json, injected at build time so the notes themselves can load lazily. */
declare const __LATEST_RELEASE__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __IS_PROD__: boolean;

interface ImportMetaEnv {
    /** WebMCP origin-trial token; injected as an origin-trial meta tag in production builds only. */
    readonly VITE_WEBMCP_OT_TOKEN?: string;
}
