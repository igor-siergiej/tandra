import { beforeEach, describe, expect, it } from 'bun:test';

import { UuidGenerator } from './index';

describe('UuidGenerator', () => {
    let generator: UuidGenerator;

    beforeEach(() => {
        generator = new UuidGenerator();
    });

    describe('Generating unique identifiers', () => {
        describe('When generating a UUID', () => {
            it('should produce a valid UUID v4 format', () => {
                const uuid = generator.generate();

                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

                expect(uuid).toMatch(uuidRegex);
            });

            it('should return a string value', () => {
                const uuid = generator.generate();

                expect(uuid).toEqual(expect.any(String));
            });

            it('should have the correct length', () => {
                const uuid = generator.generate();

                expect(uuid.length).toBe(36);
            });
        });

        describe('When generating multiple UUIDs', () => {
            it('should produce unique identifiers each time', () => {
                const uuids = Array.from({ length: 100 }, () => generator.generate());
                const uniqueUuids = new Set(uuids);

                expect(uniqueUuids.size).toBe(100);
            });
        });
    });
});
