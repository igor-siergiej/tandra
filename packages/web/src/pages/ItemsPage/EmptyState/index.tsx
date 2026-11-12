import type { ListType } from '@tandra/types';
import { ShoppingCart } from 'lucide-react';

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../../components/ui/empty';

interface EmptyStateProps {
    listType: ListType;
}

export const EmptyState = ({ listType: _listType }: EmptyStateProps) => {
    return (
        <Empty className="flex-none justify-start p-4">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <ShoppingCart />
                </EmptyMedia>
                <EmptyTitle>No items yet</EmptyTitle>
                <EmptyDescription>Start adding items to your shopping list</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
};
