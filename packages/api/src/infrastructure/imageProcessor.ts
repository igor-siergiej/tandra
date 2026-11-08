import sharp, { type ResizeOptions, type WebpOptions, type WriteableMetadata } from 'sharp';

/** The part of a sharp pipeline the image helpers drive. sharp itself satisfies it; a test passes a recording double. */
export interface ImagePipeline {
    resize(width: number, height: number, options: ResizeOptions): ImagePipeline;
    webp(options: WebpOptions): ImagePipeline;
    withMetadata(metadata: WriteableMetadata): ImagePipeline;
    toBuffer(): Promise<Buffer>;
}

/** Opens a pipeline over an image buffer: `sharp` in production. */
export type SharpFactory = (input: Buffer) => ImagePipeline;

/** Resize to a `size` square and re-encode as WebP, through `sharpFactory` when one is injected. */
export async function processImage(
    inputBuffer: Buffer,
    sharpFactory: SharpFactory = sharp,
    size = 256
): Promise<Buffer> {
    return await sharpFactory(inputBuffer)
        .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            withoutEnlargement: true,
        })
        .webp({
            quality: 85,
            effort: 4,
            lossless: false,
            smartSubsample: true,
        })
        .withMetadata({})
        .toBuffer();
}

const UPLOAD_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff']);
const UPLOAD_MAX_PIXELS = 40_000_000;
const UPLOAD_MAX_EDGE = 2048;

/**
 * Decode a user upload and re-encode it as WebP. The client's MIME type is never trusted: only raster formats sharp
 * detects from the bytes are accepted (SVG and garbage are rejected), and re-encoding strips metadata and any payload
 * that is not pixels. Throws a 400 for anything that is not a usable image.
 */
export async function normaliseUpload(inputBuffer: Buffer): Promise<Buffer> {
    try {
        const image = sharp(inputBuffer, { limitInputPixels: UPLOAD_MAX_PIXELS });
        const { format } = await image.metadata();

        if (!format || !UPLOAD_FORMATS.has(format)) {
            throw new Error(`unsupported format: ${format}`);
        }

        return await image
            .rotate()
            .resize(UPLOAD_MAX_EDGE, UPLOAD_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
    } catch {
        throw Object.assign(new Error('File must be a valid image (JPEG, PNG, WebP, GIF, AVIF or HEIF)'), {
            status: 400,
        });
    }
}
