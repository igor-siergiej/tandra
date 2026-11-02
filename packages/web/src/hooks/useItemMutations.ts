import type { Item, ItemCategory, ListType } from '@tandra/types';
import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useListSource } from './useListSource';

interface OptimisticMutationContext {
    previousData: { listType: ListType; items: Item[] } | undefined;
}

function createOptimisticMutation<TVariables>(
    queryClient: QueryClient,
    listTitle: string,
    mutationFn: (vars: TVariables) => Promise<unknown>,
    applyOptimisticUpdate: (items: Item[], vars: TVariables) => Item[]
) {
    return {
        mutationFn,
        onMutate: async (variables: TVariables) => {
            await queryClient.cancelQueries({ queryKey: [listTitle] });
            const previousData = queryClient.getQueryData<{ listType: ListType; items: Item[] }>([listTitle]);

            queryClient.setQueryData<{ listType: ListType; items: Item[] }>([listTitle], (old) =>
                old
                    ? {
                          ...old,
                          items: applyOptimisticUpdate(old.items, variables),
                      }
                    : undefined
            );

            return { previousData };
        },
        onError: (_err: unknown, _variables: TVariables, context?: OptimisticMutationContext) => {
            if (context?.previousData) {
                queryClient.setQueryData([listTitle], context.previousData);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: [listTitle] });
        },
    };
}

export function useItemMutations(listTitle: string, itemId: string) {
    const queryClient = useQueryClient();
    const source = useListSource();

    const toggleMutation = useMutation(
        createOptimisticMutation(
            queryClient,
            listTitle,
            (isSelected: boolean) => source.toggleItem(listTitle, itemId, isSelected),
            (items, isSelected) => items.map((i) => (i.id === itemId ? { ...i, isSelected } : i))
        ) as UseMutationOptions<unknown, unknown, boolean, OptimisticMutationContext>
    );

    const deleteMutation = useMutation(
        createOptimisticMutation(
            queryClient,
            listTitle,
            () => source.deleteItem(listTitle, itemId),
            (items) => items.filter((i) => i.id !== itemId)
        ) as UseMutationOptions<unknown, unknown, undefined, OptimisticMutationContext>
    );

    const updateNameMutation = useMutation(
        createOptimisticMutation(
            queryClient,
            listTitle,
            (newName: string) => source.renameItem(listTitle, itemId, newName),
            (items, newName) => items.map((i) => (i.id === itemId ? { ...i, name: newName } : i))
        ) as UseMutationOptions<unknown, unknown, string, OptimisticMutationContext>
    );

    const updateQuantityMutation = useMutation(
        createOptimisticMutation(
            queryClient,
            listTitle,
            ({ quantity, unit }: { quantity?: number; unit?: string }) =>
                source.setItemQuantity(listTitle, itemId, { quantity, unit }),
            (items, { quantity, unit }) =>
                items.map((i) =>
                    i.id === itemId
                        ? {
                              ...i,
                              ...(quantity !== undefined && { quantity }),
                              ...(unit !== undefined && { unit }),
                          }
                        : i
                )
        ) as UseMutationOptions<unknown, unknown, { quantity?: number; unit?: string }, OptimisticMutationContext>
    );

    const updateCategoryMutation = useMutation(
        createOptimisticMutation(
            queryClient,
            listTitle,
            (category: ItemCategory) => source.setItemCategory(listTitle, itemId, category),
            (items, category) => items.map((i) => (i.id === itemId ? { ...i, category } : i))
        ) as UseMutationOptions<unknown, unknown, ItemCategory, OptimisticMutationContext>
    );

    return {
        toggleMutation,
        deleteMutation,
        updateNameMutation,
        updateQuantityMutation,
        updateCategoryMutation,
    };
}
