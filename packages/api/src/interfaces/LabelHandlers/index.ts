import { dependencyContainer } from '../../dependencies/container';
import { DependencyToken } from '../../dependencies/types';
import type { CreateLabelInput, LabelService, UpdateLabelInput } from '../../domain/LabelService';
import { withAuth } from '../handlerUtils';

const getLabelService = (): LabelService => dependencyContainer.resolve(DependencyToken.LabelService);

export const getLabels = withAuth(async (c, user) => {
    return c.json(await getLabelService().getLabelsByOwner(user.id), 200);
});

export const createLabel = withAuth(async (c, user) => {
    const body = await c.req.json<CreateLabelInput>();

    return c.json(await getLabelService().createLabel(user.id, body), 201);
});

export const updateLabel = withAuth(async (c, user) => {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateLabelInput>();

    return c.json(await getLabelService().updateLabel(id, user.id, body), 200);
});

export const deleteLabel = withAuth(async (c, user) => {
    const id = c.req.param('id');
    await getLabelService().deleteLabel(id, user.id);

    return new Response(null, { status: 204 });
});
