import type { ListType } from '@tandra/types';
import { ListType as ListTypeEnum } from '@tandra/types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { addItemsBulk, type SpokenItem } from '../../api';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { GroupByAisleToggle } from '../../components/GroupByAisleToggle';
import ItemCheckBoxList from '../../components/ItemCheckBoxList';
import { ListViewers } from '../../components/ListViewers';
import { ItemsSkeleton } from '../../components/LoadingSkeleton';
import ToolBar from '../../components/ToolBar';
import { usePullToRefreshContext } from '../../contexts/PullToRefreshContext';
import { useGuest } from '../../guest/GuestContext';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useGoBack } from '../../hooks/useGoBack';
import { useGroupByAisle } from '../../hooks/useGroupByAisle';
import { useItemPageMutations } from '../../hooks/useItemPageMutations';
import { useListSource } from '../../hooks/useListSource';
import { track } from '../../utils/analytics';
import { logger } from '../../utils/logger';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

// Page-level wiring of query, mutations, confirmations and layout in one component.
// fallow-ignore-next-line complexity
const ItemsPage = () => {
    const { listTitle } = useParams();
    const handleGoBack = useGoBack('/');
    const [currentListType, setCurrentListType] = useState<ListType>(ListTypeEnum.SHOPPING);
    const [groupByAisle, toggleGroupByAisle] = useGroupByAisle();
    const { confirm, isOpen, config: confirmConfig, handleConfirm, handleCancel } = useConfirmation();
    const { isGuest } = useGuest();
    const source = useListSource();

    const { data, isLoading, isError, refetch } = useQuery({
        ...source.listQuery(listTitle ?? ''),
        enabled: !!listTitle,
    });

    const listType = data?.listType || ListTypeEnum.SHOPPING;
    const items = data?.items || [];
    const users = data?.users || [];
    const ownerId = data?.ownerId;
    const selectedItemsCount = items.filter((item) => item.isSelected).length;

    const { addItemMutation, clearSelectedMutation, clearListMutation } = useItemPageMutations(listTitle);
    const { registerRefresh } = usePullToRefreshContext();

    useEffect(() => {
        return registerRefresh(async () => {
            await refetch();
        });
    }, [registerRefresh, refetch]);

    useEffect(() => {
        setCurrentListType(listType);
    }, [listType]);

    useEffect(() => {
        if (listTitle) {
            logger.info('Items page loaded', { listTitle, itemCount: items.length, listType });
        }
    }, [listTitle, items.length, listType]);

    if (!listTitle) {
        return <div>Need a valid list title</div>;
    }

    const isEmpty = items.length === 0;

    const handleClearList = () => {
        if (items.length === 0) return;

        confirm({
            title: 'Clear All Items?',
            description: `Are you sure you want to delete all ${items.length} items from this list? This action cannot be undone.`,
            actionLabel: 'Clear All Items',
            onConfirm: () => {
                clearListMutation.mutate();
            },
        });
    };

    const handleClearSelected = () => {
        if (selectedItemsCount === 0) return;

        confirm({
            title: 'Clear Selected Items?',
            description: `Are you sure you want to delete ${selectedItemsCount} selected item${selectedItemsCount === 1 ? '' : 's'}? This action cannot be undone.`,
            actionLabel: 'Clear Selected',
            onConfirm: () => {
                clearSelectedMutation.mutate();
            },
        });
    };

    const handleAddItem = async (itemName: string, quantity?: number, unit?: string) => {
        const { promise, resolve, reject } = Promise.withResolvers<void>();
        addItemMutation.mutate(
            { id: crypto.randomUUID(), itemName, quantity, unit },
            {
                onSuccess: () => {
                    track('item_added', { source: 'typed', count: 1 });
                    resolve();
                },
                onError: reject,
            }
        );

        return promise;
    };

    const handleAddItems = async (spoken: Array<SpokenItem>) => {
        await addItemsBulk(
            listTitle,
            spoken.map(({ name, quantity, unit }) => ({ itemName: name, quantity, unit }))
        );
        track('item_added', { source: 'voice', count: spoken.length });
        await refetch();
    };

    return (
        <>
            {isLoading && <ItemsSkeleton />}
            {isError && !data && <ErrorState onRetry={() => void refetch()} />}
            {!isLoading && data && (
                <div className="flex flex-col">
                    {!isGuest && <ListViewers listTitle={listTitle} />}
                    {isEmpty ? (
                        <EmptyState listType={currentListType} />
                    ) : (
                        <>
                            {listType === ListTypeEnum.SHOPPING && (
                                <GroupByAisleToggle grouped={groupByAisle} onToggle={toggleGroupByAisle} />
                            )}
                            <ItemCheckBoxList
                                items={items}
                                listTitle={listTitle}
                                listType={listType}
                                groupByAisle={groupByAisle && listType === ListTypeEnum.SHOPPING}
                                showImages={!isGuest}
                            />
                        </>
                    )}
                </div>
            )}

            <ToolBar
                onAddItem={handleAddItem}
                // Voice parsing is an account-only AI call, so guests get the typed add only.
                onAddItems={isGuest ? undefined : handleAddItems}
                handleGoBack={handleGoBack}
                handleClearSelected={handleClearSelected}
                handleRemoveAll={handleClearList}
                placeholder="Enter item name..."
                currentListType={currentListType}
                currentList={
                    listTitle && users.length > 0
                        ? {
                              title: listTitle,
                              displayTitle: data?.title,
                              users,
                              ownerId,
                          }
                        : undefined
                }
                listItems={items}
                refetchList={refetch}
                disableClearSelected={selectedItemsCount === 0}
                disableClearAll={items.length === 0}
            />

            <ConfirmationDialog
                open={isOpen}
                title={confirmConfig?.title}
                description={confirmConfig?.description}
                cancelLabel={confirmConfig?.cancelLabel}
                actionLabel={confirmConfig?.actionLabel}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
            />
        </>
    );
};

export default ItemsPage;
