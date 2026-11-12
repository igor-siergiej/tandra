import { dependencyContainer } from '../../dependencies/container';
import { DependencyToken } from '../../dependencies/types';
import type { CreateMealPlanInput, MealPlanService, UpdateMealPlanInput } from '../../domain/MealPlanService';
import { withAuth } from '../handlerUtils';

const getMealPlanService = (): MealPlanService => dependencyContainer.resolve(DependencyToken.MealPlanService);

export const getMealPlan = withAuth(async (c, user) => {
    const entries = await getMealPlanService().list(user.id, c.req.query('from') ?? '', c.req.query('to') ?? '');

    return c.json(entries, 200);
});

export const createMealPlanEntry = withAuth(async (c, user) => {
    const body = await c.req.json<CreateMealPlanInput>();

    return c.json(await getMealPlanService().create(user.id, body), 201);
});

export const updateMealPlanEntry = withAuth(async (c, user) => {
    const body = await c.req.json<UpdateMealPlanInput>();

    return c.json(await getMealPlanService().update(c.req.param('id'), user.id, body), 200);
});

export const deleteMealPlanEntry = withAuth(async (c, user) => {
    await getMealPlanService().remove(c.req.param('id'), user.id);

    return new Response(null, { status: 204 });
});
