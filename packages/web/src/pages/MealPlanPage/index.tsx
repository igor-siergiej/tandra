import type { MealPlanEntry, Recipe } from '@tandra/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { useMemo, useState } from 'react';

import {
    addItemsBulk,
    createMealPlanEntry,
    deleteMealPlanEntry,
    getListsQuery,
    getMealPlanQuery,
    getRecipesQuery,
    updateMealPlanEntry,
} from '../../api';
import { useUser } from '../../auth';
import ToolBar from '../../components/ToolBar';
import { Button } from '../../components/ui/button';
import { buildShoppingRows, dayKey, type ShoppingRow, weekDays, weekStart } from '../../utils/mealPlan';
import { notifyError, notifySuccess } from '../../utils/toast';
import { MealPlanDayCard } from './MealPlanDayCard';
import { RecipePickerDrawer } from './RecipePickerDrawer';
import { ShoppingPreviewDrawer } from './ShoppingPreviewDrawer';
import { WeekNavigation } from './WeekNavigation';

// Page-level wiring of queries, mutations and drawers in one component.
// fallow-ignore-next-line complexity
const MealPlanPage = () => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const [start, setStart] = useState(() => weekStart(new Date()));
    const [pickerDay, setPickerDay] = useState<Date | null>(null);
    const [isShopOpen, setIsShopOpen] = useState(false);

    const days = weekDays(start);
    const from = dayKey(days[0]);
    const to = dayKey(days[6]);
    const planKey = getMealPlanQuery(from, to).queryKey;

    const { data: entries = [] } = useQuery(getMealPlanQuery(from, to));

    // SAFETY: the placeholder query never resolves recipes for a signed-out user; an empty array is a valid Recipe[].
    const { data: recipes = [] } = useQuery(
        user?.id ? getRecipesQuery(user.id) : { queryKey: [], queryFn: async () => [] as Recipe[] }
    );

    const { data: lists = [] } = useQuery(
        user?.id ? getListsQuery(user.id) : { queryKey: [], queryFn: async () => [] }
    );

    const refresh = () => queryClient.invalidateQueries({ queryKey: planKey });
    const onError = (error: Error) => notifyError(error instanceof Error ? error.message : 'Something went wrong');

    const addMutation = useMutation({ mutationFn: createMealPlanEntry, onSuccess: refresh, onError });

    // The stepper reads entry.servings from this cache, so it's updated before the request: a second
    // tap before the refetch would otherwise send the same value again and lose an increment. The
    // scope runs the updates one after another, so the server ends on the last tap's value.
    const servingsMutation = useMutation({
        mutationFn: ({ id, servings }: { id: string; servings: number }) => updateMealPlanEntry(id, { servings }),
        scope: { id: 'meal-plan-servings' },
        onMutate: async ({ id, servings }) => {
            await queryClient.cancelQueries({ queryKey: planKey });
            const previous = queryClient.getQueryData<Array<MealPlanEntry>>(planKey);
            queryClient.setQueryData<Array<MealPlanEntry>>(planKey, (old) =>
                old?.map((entry) => (entry.id === id ? { ...entry, servings } : entry))
            );

            return { previous };
        },
        onError: (error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(planKey, context.previous);
            onError(error);
        },
        onSettled: refresh,
    });

    const removeMutation = useMutation({ mutationFn: deleteMealPlanEntry, onSuccess: refresh, onError });

    const recipeById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);

    const entriesByDay = useMemo(() => {
        const map = new Map<string, Array<MealPlanEntry>>();

        for (const entry of entries) {
            const list = map.get(entry.date) ?? [];
            list.push(entry);
            map.set(entry.date, list);
        }

        return map;
    }, [entries]);

    const todayKey = dayKey(new Date());
    const isOnCurrentWeek = dayKey(start) === dayKey(weekStart(new Date()));
    const shoppingRows = buildShoppingRows(entries, recipes);

    const handlePick = (recipe: Recipe) => {
        if (!pickerDay) return;
        addMutation.mutate({ date: dayKey(pickerDay), recipeId: recipe.id, servings: recipe.servings ?? 2 });
        setPickerDay(null);
    };

    const handleShop = async (listTitle: string, rows: Array<ShoppingRow>) => {
        const result = await addItemsBulk(
            listTitle,
            rows.map((row) => ({ itemName: row.name, quantity: row.quantity, unit: row.unit }))
        );

        await queryClient.invalidateQueries({ queryKey: [listTitle] });
        notifySuccess(`${result.added} items added, ${result.skipped} merged`);
    };

    return (
        <>
            <div className="flex flex-col gap-4">
                <WeekNavigation
                    start={start}
                    isOnCurrentWeek={isOnCurrentWeek}
                    onPrev={() => setStart(addDays(start, -7))}
                    onNext={() => setStart(addDays(start, 7))}
                    onToday={() => setStart(weekStart(new Date()))}
                />

                {days.map((day) => {
                    const key = dayKey(day);

                    return (
                        <MealPlanDayCard
                            key={key}
                            day={day}
                            isToday={key === todayKey}
                            entries={entriesByDay.get(key) ?? []}
                            recipeById={recipeById}
                            canRemove={(entry) => entry.ownerId === user?.id}
                            onPick={setPickerDay}
                            onServingsChange={(entry, servings) => servingsMutation.mutate({ id: entry.id, servings })}
                            onRemove={(entry) => removeMutation.mutate(entry.id)}
                        />
                    );
                })}

                <Button onClick={() => setIsShopOpen(true)} disabled={shoppingRows.length === 0}>
                    Shop for this week
                </Button>
            </div>

            <RecipePickerDrawer
                open={pickerDay !== null}
                dayLabel={pickerDay ? format(pickerDay, 'EEEE') : ''}
                recipes={recipes}
                onPick={handlePick}
                onOpenChange={(open) => !open && setPickerDay(null)}
            />
            <ShoppingPreviewDrawer
                open={isShopOpen}
                rangeLabel={`${format(days[0], 'd MMM')} – ${format(days[6], 'd MMM')}`}
                rows={shoppingRows}
                lists={lists}
                onConfirm={handleShop}
                onOpenChange={setIsShopOpen}
            />
            <ToolBar handleGoBack={() => window.history.back()} />
        </>
    );
};

export default MealPlanPage;
