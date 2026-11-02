import { Readable } from 'node:stream';

import type { Context } from 'hono';

import { dependencyContainer } from '../../dependencies';
import { DependencyToken } from '../../dependencies/types';
import type { ImageService } from '../../domain/ImageService';
import type { HonoVars } from '../handlerUtils';

const getImageService = (): ImageService => dependencyContainer.resolve(DependencyToken.ImageService);
const getBucketStore = () => dependencyContainer.resolve(DependencyToken.ImageStore);
const getRecipeService = () => dependencyContainer.resolve(DependencyToken.RecipeService);
const getDiscoveryService = () => dependencyContainer.resolve(DependencyToken.DiscoveryService);
const getLogger = () => dependencyContainer.resolve(DependencyToken.Logger);

// Upload keys are recipe-upload/<ownerId>/<recipeId>/<timestamp>.<ext>. Readable only while a recipe the caller
// belongs to still uses that exact key as its cover. Exercised by the recipe-upload cases in index.test.ts.
// fallow-ignore-next-line complexity
const canReadUpload = async (key: string, userId: string): Promise<boolean> => {
    const recipeId = key.split('/')[2];

    if (!recipeId) return false;

    try {
        const recipe = await getRecipeService().getRecipe(recipeId);

        return recipe.coverImageKey === key && (recipe.users ?? []).some((u: { id: string }) => u.id === userId);
    } catch {
        return false;
    }
};

// One branch per object-key family (uploads, published covers, AI recipe images, item images), each with its own access rule.
// fallow-ignore-next-line complexity
export const getImage = async (c: Context<HonoVars>) => {
    const name = c.req.param('name');
    const logger = getLogger();

    try {
        if (name.startsWith('recipe-upload/')) {
            const user = c.get('user');

            if (!user?.id) {
                return c.json({ error: 'Unauthorized' }, 401);
            }

            if (!(await canReadUpload(name, user.id))) {
                return c.json({ error: 'Image not found' }, 404);
            }

            const bucketStore = getBucketStore();
            const head = await bucketStore.getHeadObject(name);

            if (head) {
                const contentType = head.metaData?.['content-type'] ?? 'image/webp';
                const stream = await bucketStore.getObjectStream(name);

                logger.info('API: Stored image retrieved', {
                    imageKey: name,
                    userId: user.id,
                    contentType,
                });

                c.header('Content-Type', contentType);
                // private: the key is immutable, but only recipe members may read it, so no shared cache may keep a copy.
                c.header('Cache-Control', 'private, max-age=31536000, immutable');

                return c.body(Readable.toWeb(stream as Readable) as unknown as ReadableStream);
            }

            return c.json({ error: 'Image not found' }, 404);
        }

        // A published recipe's cover. Served only while a library recipe still uses it (auth is applied by the route):
        // unpublishing or delisting the recipe takes the picture down with it, even though the object itself stays.
        if (name.startsWith('discovery-image/')) {
            if (!(await getDiscoveryService().hasCoverImageKey(name))) {
                return c.json({ error: 'Image not found' }, 404);
            }

            const bucketStore = getBucketStore();

            try {
                const head = await bucketStore.getHeadObject(name);
                const contentType = head?.metaData?.['content-type'] ?? 'image/webp';
                const stream = await bucketStore.getObjectStream(name);

                c.header('Content-Type', contentType);
                c.header('Cache-Control', 'private, max-age=3600');

                return c.body(Readable.toWeb(stream as Readable) as unknown as ReadableStream);
            } catch {
                return c.json({ error: 'Image not found' }, 404);
            }
        }

        if (name.startsWith('recipe-image/')) {
            const bucketStore = getBucketStore();

            try {
                const head = await bucketStore.getHeadObject(name);
                const contentType = head?.metaData?.['content-type'] ?? 'image/webp';
                const stream = await bucketStore.getObjectStream(name);

                logger.info('API: Recipe AI image retrieved', { imageKey: name, contentType });

                c.header('Content-Type', contentType);
                c.header('Cache-Control', 'public, max-age=31536000, immutable');

                return c.body(Readable.toWeb(stream as Readable) as unknown as ReadableStream);
            } catch {
                return c.json({ error: 'Image not found' }, 404);
            }
        }

        const { stream, contentType, cacheControl } = await getImageService().getImage(name, c.get('user')?.id);

        logger.info('API: AI image retrieved', { itemName: name, contentType });

        c.header('Content-Type', contentType);
        c.header('Cache-Control', cacheControl);

        return c.body(Readable.toWeb(stream as Readable) as unknown as ReadableStream);
    } catch (error: unknown) {
        const err = error as { status?: number; message?: string };

        logger.error('API: Failed to retrieve image', { itemName: name, error: err.message });

        return c.json({ error: err.message ?? 'Internal Server Error' }, (err.status ?? 500) as 500);
    }
};
