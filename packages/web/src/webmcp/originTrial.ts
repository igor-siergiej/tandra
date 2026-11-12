const META_NAME = 'origin-trial';

/**
 * Production-only: injects the WebMCP origin-trial token (VITE_WEBMCP_OT_TOKEN) as an origin-trial meta tag.
 * Without a token, or in dev, nothing is added and Chrome behaves as before.
 */
export const installWebMcpOriginTrialToken = (token: string | undefined, isProd: boolean): boolean => {
    if (!isProd || !token) return false;

    if (document.querySelector(`meta[http-equiv="${META_NAME}"][content="${token}"]`)) return false;

    const meta = document.createElement('meta');
    meta.httpEquiv = META_NAME;
    meta.content = token;
    document.head.appendChild(meta);

    return true;
};
