import type { Ingredient, Recipe, User } from '@tandra/types';
import { useQueryClient } from '@tanstack/react-query';

import { drainOutbox } from '../offline/drainer';
import { applyRecipeIntent } from '../offline/intents';
import { type OutboxIntent, outboxStore } from '../offline/outboxStore';
import { useFriends } from './useFriends';

export const useRecipeMutations = (user: User | undefined) => {
    const queryClient = useQueryClient();
    const { friends } = useFriends();
    const userId = user?.id ?? '';

    const enqueueRecipe = async (op: OutboxIntent['op'], targetId: string, payload: Record<string, unknown>) => {
        const intent: Omit<OutboxIntent, 'seq'> = {
            id: crypto.randomUUID(),
            entityType: 'recipe',
            op,
            targetId,
            scope: userId,
            payload,
            createdAt: Date.now(),
        };
        queryClient.setQueryData<Recipe[]>(['recipes', userId], (old) =>
            applyRecipeIntent(old ?? [], intent as OutboxIntent)
        );
        if (op === 'recipe.update') {
            queryClient.setQueryData<Recipe | undefined>(['recipe', targetId], (old) =>
                old ? (applyRecipeIntent([old], intent as OutboxIntent)[0] ?? old) : old
            );
        }
        await outboxStore.enqueue(intent);
        if (op === 'recipe.create') {
            await drainOutbox();
        } else {
            void drainOutbox();
        }
    };

    return {
        createRecipe: async (
            title: string,
            selectedUsers: string[],
            ingredients?: Array<{ name: string; quantity?: number; unit?: string }>,
            link?: string,
            instructions?: string[],
            tags?: string[],
            prepTime?: number,
            cookTime?: number,
            servings?: number,
            difficulty?: Recipe['difficulty']
        ): Promise<string> => {
            const id = crypto.randomUUID();
            const sharedFriends = friends.filter((f) => selectedUsers.includes(f.id));
            await enqueueRecipe('recipe.create', id, {
                title,
                selectedUsers,
                ingredients,
                link,
                instructions,
                tags,
                user,
                users: user ? [user, ...sharedFriends] : sharedFriends,
                ownerId: userId,
                prepTime,
                cookTime,
                servings,
                difficulty,
            });
            return id;
        },

        // fallow-ignore-next-line complexity
        updateRecipe: async (
            recipeId: string,
            title: string,
            ingredients: Ingredient[],
            coverImageKey?: string,
            link?: string,
            instructions?: string[],
            tags?: string[],
            prepTime?: number,
            cookTime?: number,
            servings?: number,
            difficulty?: Recipe['difficulty']
        ): Promise<void> => {
            await enqueueRecipe('recipe.update', recipeId, {
                title,
                ingredients,
                ...(coverImageKey !== undefined && { coverImageKey }),
                ...(link !== undefined && { link }),
                ...(instructions !== undefined && { instructions }),
                ...(tags !== undefined && { tags }),
                prepTime,
                cookTime,
                servings,
                difficulty,
            });
        },

        deleteRecipe: async (recipeId: string): Promise<void> => {
            await enqueueRecipe('recipe.delete', recipeId, {});
        },
    };
};
