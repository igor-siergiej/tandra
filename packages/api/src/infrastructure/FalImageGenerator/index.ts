import sharp from 'sharp';

import type { ImageGenerator } from '../../domain/ImageService/types';
import { processImage } from '../imageProcessor';

const FETCH_TIMEOUT_MS = 30_000;

export interface FalImageGeneratorOptions {
    model?: string;
    imageSize?: string;
    numInferenceSteps?: number;
    outputFormat?: 'jpeg' | 'png';
    outputSize?: number;
    processor?: typeof processImage;
    sharpFactory?: typeof sharp;
}

export class FalImageGenerator implements ImageGenerator {
    private readonly model: string;
    private readonly imageSize: string;
    private readonly numInferenceSteps: number;
    private readonly outputFormat: 'jpeg' | 'png';
    private readonly outputSize: number;
    private readonly processor: typeof processImage;
    private readonly sharpFactory: typeof sharp;

    constructor(
        private readonly apiKey: string,
        options: FalImageGeneratorOptions = {}
    ) {
        this.model = options.model ?? 'fal-ai/flux/schnell';
        this.imageSize = options.imageSize ?? 'square';
        this.numInferenceSteps = options.numInferenceSteps ?? 4;
        this.outputFormat = options.outputFormat ?? 'png';
        this.outputSize = options.outputSize ?? 256;
        this.processor = options.processor ?? processImage;
        this.sharpFactory = options.sharpFactory ?? sharp;
    }

    async generateImage(prompt: string): Promise<{ buffer: Buffer; contentType: string }> {
        if (!this.apiKey) {
            throw Object.assign(new Error('AI is disabled on this server (FAL_KEY is not set)'), {
                status: 503,
                code: 'ai_disabled',
            });
        }

        // sync_mode returns the image inline as a data URI, avoiding a second fetch.
        const response = await fetch(`https://fal.run/${this.model}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Key ${this.apiKey}`,
            },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            body: JSON.stringify({
                prompt,
                image_size: this.imageSize,
                num_inference_steps: this.numInferenceSteps,
                num_images: 1,
                output_format: this.outputFormat,
                sync_mode: true,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw Object.assign(new Error(`fal.ai API error: ${error}`), { status: 502 });
        }

        const data = (await response.json()) as unknown;

        const image = (data as { images?: Array<{ url?: string }> }).images?.[0];
        let originalBuffer: Buffer;

        if (image && typeof image === 'object' && typeof image.url === 'string') {
            const { url } = image;

            if (url.startsWith('data:')) {
                // Data URI: strip the "data:<mime>;base64," prefix and decode.
                const b64 = url.slice(url.indexOf(',') + 1);
                originalBuffer = Buffer.from(b64, 'base64');
            } else {
                const imageResponse = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

                if (!imageResponse.ok) {
                    throw Object.assign(new Error('Failed to download image from fal.ai'), { status: 502 });
                }

                originalBuffer = Buffer.from(await imageResponse.arrayBuffer());
            }
        } else {
            throw Object.assign(new Error(`Invalid image generation response: ${JSON.stringify(data)}`), {
                status: 502,
            });
        }

        // Process the image: convert to WebP, resize, and compress
        let processedBuffer: Buffer;
        let finalContentType = 'image/webp';

        try {
            processedBuffer = await this.processor(originalBuffer, undefined, this.outputSize);
        } catch {
            // Fallback: try to at least convert to WebP without resizing
            try {
                processedBuffer = await this.sharpFactory(originalBuffer)
                    .webp({ quality: 85 })
                    .withMetadata({})
                    .toBuffer();
                finalContentType = 'image/webp';
            } catch {
                processedBuffer = originalBuffer;
                finalContentType = 'image/png';
            }
        }

        return {
            buffer: processedBuffer,
            contentType: finalContentType,
        };
    }
}
