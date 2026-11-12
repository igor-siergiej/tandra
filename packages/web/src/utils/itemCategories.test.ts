import type { Item } from '@tandra/types';
import { describe, expect, it } from 'vite-plus/test';

import { groupByCategory } from './itemCategories';

const item = (id: string, category?: Item['category']): Item =>
    ({ id, name: id, isSelected: false, dateAdded: new Date(), category }) as Item;

describe('itemCategories', () => {
    it('treats an unclassified item as other', () => {
        expect(groupByCategory([item('a')])).toEqual([
            { category: 'other', items: [expect.objectContaining({ id: 'a' })] },
        ]);
    });

    it('groups in aisle order and drops empty aisles', () => {
        const groups = groupByCategory([item('a', 'frozen'), item('b'), item('c', 'produce'), item('d', 'frozen')]);

        expect(groups.map((g) => g.category)).toEqual(['produce', 'frozen', 'other']);
        expect(groups[1].items.map((i) => i.id)).toEqual(['a', 'd']);
    });
});
