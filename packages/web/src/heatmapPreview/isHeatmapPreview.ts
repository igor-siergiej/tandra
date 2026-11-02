/**
 * True when the app runs inside a cross-origin frame. The only page allowed to frame the app
 * cross-origin is the Umami dashboard (nginx.conf: `frame-ancestors 'self' https://analytics.imapps.uk`),
 * which loads the recorded page so it can draw heatmap clicks on top of it. That frame has no session
 * (the auth cookie is SameSite=Lax), so instead of the login screen the app renders placeholder data.
 */
const detect = (): boolean => {
    if (typeof window === 'undefined' || window.self === window.top) return false;

    try {
        // Reading a cross-origin parent's location throws; a same-origin parent is the app framing itself.
        return window.top?.location.origin !== window.location.origin;
    } catch {
        return true;
    }
};

export const isHeatmapPreview = detect();
