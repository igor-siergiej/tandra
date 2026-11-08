import { beforeEach, describe, expect, it } from 'bun:test';

import { RecordingImageGenerator, RecordingImageStore, RecordingLogger } from '../../testing/doubles';
import { fake } from '../../testing/fake';
import { RecipeImageService } from './index';

const mockStore = new RecordingImageStore();
const mockGenerator = new RecordingImageGenerator();
const mockLogger = new RecordingLogger();

describe('RecipeImageService', () => {
    let service: RecipeImageService;

    beforeEach(() => {
        mockStore.reset();
        mockGenerator.reset();
        mockLogger.reset();
        service = new RecipeImageService(mockStore, mockGenerator, fake(mockLogger));
    });

    describe('generateRecipeImage', () => {
        const ingredients = [
            { id: '1', name: 'chicken' },
            { id: '2', name: 'garlic' },
            { id: '3', name: 'lemon' },
        ];

        it('returns existing key when image already in store', async () => {
            mockStore.resolvedValues.getHeadObject = { metaData: {} };

            const key = await service.generateRecipeImage('rec-1', 'Lemon Chicken', ingredients);

            expect(key).toBe('recipe-image/rec-1.webp');
            expect(mockGenerator.calls.generateImage.length).toBe(0);
            expect(mockStore.calls.putObject.length).toBe(0);
        });

        it('generates and stores image when not in store', async () => {
            mockStore.rejectedErrors.getHeadObject = new Error('Not found');

            const key = await service.generateRecipeImage('rec-2', 'Lemon Chicken', ingredients);

            expect(key).toBe('recipe-image/rec-2.webp');
            expect(mockGenerator.calls.generateImage.length).toBe(1);
            expect(mockGenerator.calls.generateImage[0][0]).toBe(
                'Appetising food photography of Lemon Chicken, featuring chicken, garlic, lemon, soft natural lighting, shallow depth of field, served on a wooden table, no text, no watermark.'
            );
            expect(mockStore.calls.putObject[0][0]).toBe('recipe-image/rec-2.webp');
        });

        it('builds prompt with no ingredient clause when ingredients empty', async () => {
            mockStore.rejectedErrors.getHeadObject = new Error('Not found');

            await service.generateRecipeImage('rec-3', 'Mystery Dish', []);

            expect(mockGenerator.calls.generateImage[0][0]).toBe(
                'Appetising food photography of Mystery Dish, soft natural lighting, shallow depth of field, served on a wooden table, no text, no watermark.'
            );
        });

        it('uses only top 5 ingredients in prompt', async () => {
            mockStore.rejectedErrors.getHeadObject = new Error('Not found');
            const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n, i) => ({ id: String(i), name: n }));

            await service.generateRecipeImage('rec-4', 'Big Dish', many);

            const prompt = mockGenerator.calls.generateImage[0][0];
            expect(prompt).toContain('featuring a, b, c, d, e');
            expect(prompt).not.toContain('featuring a, b, c, d, e, f');
        });

        it('stores buffer returned by generator', async () => {
            mockStore.rejectedErrors.getHeadObject = new Error('Not found');
            const buf = Buffer.from('generated');
            mockGenerator.resolvedValues.generateImage = { buffer: buf, contentType: 'image/webp' };

            await service.generateRecipeImage('rec-5', 'Title', ingredients);

            expect(mockStore.calls.putObject[0][1]).toBe(buf);
            expect(mockStore.calls.putObject[0][2]).toEqual({ contentType: 'image/webp' });
        });

        it('works without logger', async () => {
            const serviceNoLogger = new RecipeImageService(mockStore, mockGenerator);
            mockStore.rejectedErrors.getHeadObject = new Error('Not found');

            const key = await serviceNoLogger.generateRecipeImage('rec-6', 'Title', ingredients);

            expect(key).toBe('recipe-image/rec-6.webp');
        });
    });
});
