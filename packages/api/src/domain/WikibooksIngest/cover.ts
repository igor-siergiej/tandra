import type { Logger } from '@imapps/api-utils';

import { caughtErrorSchema } from '../../infrastructure/caughtError';
import { withImageExtension } from '../../infrastructure/objectKey';
import type { ImageStore } from '../ImageService/types';
import { assessImage } from './imageLicence';
import type { WikibooksImageInfo, WikibooksSource } from './types';

const COVER_PREFIX = 'discovery-image';
const STORED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface CoverFields {
    coverImageKey?: string;
    coverImageAttribution?: string;
    coverImageSourceUrl?: string;
}

export interface CoverOutcome {
    fields: CoverFields;
    /**
     * True once the picture has a definite answer: stored, refused (licence, type, missing file) or absent from the page.
     * False when something transient went wrong, so the next run looks again.
     */
    decided: boolean;
    /** Why a picture was refused, for the run's log. */
    refused?: string;
}

/**
 * Turns a recipe page's cover picture into a stored, credited cover. A picture is stored only when the wiki states a
 * licence that allows reuse with credit; the credit and the picture's own page are kept so they can be shown with it.
 */
export class WikibooksCoverService {
    constructor(
        // The full interface, not a Pick: that is how static analysis sees `downloadImage` is used.
        private readonly source: WikibooksSource,
        private readonly images: ImageStore,
        private readonly logger?: Logger
    ) {}

    // One outcome per way a picture can end: none, unknown, refused, stored, failed.
    // fallow-ignore-next-line complexity
    async resolve(
        libraryId: string,
        filename: string | undefined,
        info: WikibooksImageInfo | undefined
    ): Promise<CoverOutcome> {
        if (!filename) return { fields: {}, decided: true };

        // No answer from the wiki for this name: the lookup failed, which is not the same as "no picture".
        if (!info) return { fields: {}, decided: false };

        const assessment = assessImage(info);

        if (!assessment.ok) return { fields: {}, decided: true, refused: assessment.reason };

        const { thumbUrl, mime } = info;

        // assessImage has already refused a picture without either; this narrows them for the download.
        if (!(thumbUrl && mime)) return { fields: {}, decided: true, refused: 'no downloadable rendition' };

        try {
            const download = await this.source.downloadImage(thumbUrl);
            const contentType = STORED_TYPES.has(download.contentType) ? download.contentType : mime;
            // A key of its own per recipe: it names neither a person nor a private recipe, and a rebuilt page gets a fresh one.
            const key = withImageExtension(`${COVER_PREFIX}/${libraryId}/${Date.now()}`, contentType);
            await this.images.putObject(key, download.buffer, { contentType });

            return {
                fields: {
                    coverImageKey: key,
                    coverImageAttribution: assessment.attribution,
                    coverImageSourceUrl: assessment.sourceUrl,
                },
                decided: true,
            };
        } catch (error) {
            this.logger?.warn('Wikibooks cover could not be stored, will retry next run', {
                libraryId,
                filename,
                error: caughtErrorSchema.parse(error).message,
            });

            return { fields: {}, decided: false };
        }
    }
}
