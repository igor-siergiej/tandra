const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
    'image/webp': 'webp',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
};

/** Resolve a file extension (no dot) for a content-type, or undefined if it is not a recognised image type. */
const extensionForContentType = (contentType?: string): string | undefined => {
    const normalised = contentType?.split(';')[0]?.trim().toLowerCase();

    if (!normalised) {
        return undefined;
    }

    if (CONTENT_TYPE_EXTENSIONS[normalised]) {
        return CONTENT_TYPE_EXTENSIONS[normalised];
    }

    // Fall back to the subtype for other image/* types (e.g. image/heic -> heic).
    const [type, subtype] = normalised.split('/');

    if (type === 'image' && subtype) {
        return subtype.replace(/\+.*$/, '');
    }

    return undefined;
};

/** Append the content-type's file extension to an object key. Idempotent; returns the key unchanged for unknown types. */
export const withImageExtension = (key: string, contentType?: string): string => {
    const ext = extensionForContentType(contentType);

    if (!ext || key.toLowerCase().endsWith(`.${ext}`)) {
        return key;
    }

    return `${key}.${ext}`;
};
