'use client';

import type { Ingredient, Recipe } from '@tandra/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { addItemsBulk, getListsQuery, getRecipeQuery } from '../../api';
import { useUser } from '../../auth';
import { ManageUsersDrawer } from '../../components/ManageUsersDrawer';
import ToolBar from '../../components/ToolBar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useGoBack } from '../../hooks/useGoBack';
import { useManageRecipeUsers } from '../../hooks/useManageRecipeUsers';
import { useRecipeMutations } from '../../hooks/useRecipeMutations';
import { aiTagPollInterval } from '../../utils/aiTagPoll';
import { logger } from '../../utils/logger';
import { toOptionalNumber } from '../../utils/parseRecipeMeta';
import { notifyError, notifySuccess } from '../../utils/toast';
import { CoverImageSection } from './CoverImageSection';
import { ErrorState } from './ErrorState';
import { IngredientSelectSection } from './IngredientSelectSection';
import { IngredientsSection } from './IngredientsSection';
import { InstructionsSection } from './InstructionsSection';
import { PublishSection } from './PublishSection';
import { RecipeDetailsSection } from './RecipeDetailsSection';
import { TagsSection } from './TagsSection';

// Extensive per-field state (title/link/ingredients/instructions/tags/sharing/select-mode) backs a
// single detail+edit page; each concern already has its own section component and handler below.
// fallow-ignore-next-line complexity
const RecipeDetailPage = () => {
    const { recipeId } = useParams<{ recipeId: string }>();
    const navigate = useNavigate();
    const handleGoBack = useGoBack('/recipes');
    const { user } = useUser();
    const queryClient = useQueryClient();
    const { updateRecipe, deleteRecipe } = useRecipeMutations(user ?? undefined);
    const { confirm, isOpen, config: confirmConfig, handleConfirm, handleCancel } = useConfirmation();
    const { addUserMutation, removeUserMutation } = useManageRecipeUsers({
        recipeId: recipeId ?? '',
        userId: user?.id ?? '',
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedLink, setEditedLink] = useState('');
    const [editedTags, setEditedTags] = useState<string[]>([]);
    const [editedInstructions, setEditedInstructions] = useState<string[]>([]);
    const [editedPrepTime, setEditedPrepTime] = useState('');
    const [editedCookTime, setEditedCookTime] = useState('');
    const [editedServings, setEditedServings] = useState('');
    const [editedDifficulty, setEditedDifficulty] = useState<'' | NonNullable<Recipe['difficulty']>>('');
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);

    const {
        data: recipe,
        isLoading,
        isError,
        refetch,
    } = useQuery(
        recipeId
            ? { ...getRecipeQuery(recipeId), refetchInterval: (query) => aiTagPollInterval(query.state.data) }
            : { queryKey: [], queryFn: async () => null }
    );

    const { data: lists = [] } = useQuery(
        user?.id ? getListsQuery(user.id) : { queryKey: [], queryFn: async () => [] }
    );

    const isOwner = recipe && user && recipe.ownerId === user.id;

    useEffect(() => {
        if (recipe) {
            logger.info('Recipe detail page loaded', {
                recipeId,
                title: recipe.title,
                isOwner,
                ingredientCount: recipe.ingredients.length,
            });
        }
    }, [recipe, recipeId, isOwner]);

    if (!recipeId) {
        return <div className="text-center py-8 text-muted-foreground">Invalid recipe ID</div>;
    }

    // fallow-ignore-next-line complexity
    const handleAddIngredient = async (name: string, quantity?: number, unit?: string) => {
        if (!recipe) return;

        const newIngredient: Ingredient = {
            id: `temp-${Date.now()}`,
            name,
            ...(quantity !== undefined && { quantity }),
            ...(unit !== undefined && { unit }),
        };

        const updated = [...recipe.ingredients, newIngredient];

        try {
            await updateRecipe(
                recipeId,
                recipe.title,
                updated,
                undefined,
                recipe.link,
                recipe.instructions,
                recipe.tags,
                recipe.prepTime,
                recipe.cookTime,
                recipe.servings,
                recipe.difficulty
            );
            await refetch();
        } catch (error) {
            const err = error as { message?: string };
            notifyError(err.message || 'Failed to add ingredient');
        }
    };

    // Seeds every editable field from the current recipe in one linear pass; splitting
    // further would just scatter the eight fields the edit form genuinely has.
    // fallow-ignore-next-line complexity
    const handleEditStart = () => {
        if (!recipe) return;
        setEditedTitle(recipe.title);
        setEditedLink(recipe.link ?? '');
        setEditedTags(recipe.tags ?? []);
        setEditedInstructions(recipe.instructions ?? []);
        setEditedPrepTime(recipe.prepTime?.toString() ?? '');
        setEditedCookTime(recipe.cookTime?.toString() ?? '');
        setEditedServings(recipe.servings?.toString() ?? '');
        setEditedDifficulty(recipe.difficulty ?? '');
        setIsEditing(true);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
    };

    // Single Save assembles every editable field (title/link/tags/instructions/details) from
    // local edit state — never from the possibly-stale cached recipe — into one updateRecipe
    // call, so untouched fields aren't clobbered and the user sees one toast, not five.
    // fallow-ignore-next-line complexity
    const handleSaveAll = async () => {
        if (!recipe) return;
        if (!editedTitle.trim()) {
            notifyError('Recipe title is required');
            return;
        }

        try {
            await updateRecipe(
                recipeId,
                editedTitle.trim(),
                recipe.ingredients,
                undefined,
                editedLink.trim() || undefined,
                editedInstructions.length > 0 ? editedInstructions : undefined,
                editedTags.length > 0 ? editedTags : undefined,
                toOptionalNumber(editedPrepTime),
                toOptionalNumber(editedCookTime),
                toOptionalNumber(editedServings),
                editedDifficulty || undefined
            );
            await refetch();
            setIsEditing(false);
            notifySuccess('Recipe updated');
            logger.info('Recipe updated', { recipeId, title: editedTitle });
        } catch (error) {
            const err = error as { message?: string };
            notifyError(err.message || 'Failed to update recipe');
        }
    };

    // silent skips the success toast — deleting a single ingredient shows no toast on
    // success (only on failure); adding/editing keeps the existing "Ingredients updated" toast.
    // fallow-ignore-next-line complexity
    const handleUpdateIngredients = async (ingredients: Ingredient[], options?: { silent?: boolean }) => {
        if (!recipe) return;

        try {
            await updateRecipe(
                recipeId,
                recipe.title,
                ingredients,
                undefined,
                recipe.link,
                recipe.instructions,
                recipe.tags,
                recipe.prepTime,
                recipe.cookTime,
                recipe.servings,
                recipe.difficulty
            );
            await refetch();
            if (!options?.silent) notifySuccess('Ingredients updated');
            logger.info('Recipe ingredients updated', { recipeId, ingredientCount: ingredients.length });
        } catch (error) {
            const err = error as { message?: string };
            notifyError(err.message || 'Failed to update ingredients');
            throw error;
        }
    };

    const handleDeleteRecipe = () => {
        if (!recipe) return;

        confirm({
            title: 'Delete Recipe?',
            description: `Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`,
            actionLabel: 'Delete Recipe',
            onConfirm: async () => {
                try {
                    await deleteRecipe(recipeId);
                    logger.info('Recipe deleted', { recipeId, title: recipe.title });
                    notifySuccess('Recipe deleted successfully');
                    navigate('/recipes');
                } catch (error) {
                    const err = error as { message?: string };
                    notifyError(err.message || 'Failed to delete recipe');
                }
            },
        });
    };

    const handleConfirmAddToList = async (
        listTitle: string,
        items: Array<{ itemName: string; quantity?: number; unit?: string }>
    ) => {
        try {
            const result = await addItemsBulk(listTitle, items);

            notifySuccess(`${result.added} items added, ${result.skipped} skipped`);

            await queryClient.invalidateQueries({ queryKey: [listTitle] });
            setIsSelectMode(false);
            logger.info('Ingredients added to list', {
                recipeId,
                listTitle,
                added: result.added,
                skipped: result.skipped,
            });
        } catch (error) {
            const err = error as { message?: string };
            notifyError(err.message || 'Failed to add ingredients to list');
        }
    };

    return (
        <div className="flex flex-col h-full">
            {isLoading && (
                <div className="flex-1 p-4">
                    <Skeleton className="h-8 w-32 mb-4" />
                    <Skeleton className="h-48 w-full mb-4" />
                    <Skeleton className="h-32 w-full" />
                </div>
            )}

            {isError && <ErrorState onRetry={() => void refetch()} />}

            {!isLoading && !isError && recipe && (
                <div className="flex-1 overflow-y-auto">
                    {!isSelectMode && (
                        <CoverImageSection
                            recipe={recipe}
                            isOwner={isOwner}
                            isEditing={isEditing}
                            onImageChange={() => void refetch()}
                        />
                    )}

                    <div className="p-4 space-y-6">
                        {isEditing && !isSelectMode ? (
                            <div className="space-y-2">
                                <Input
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    className="flex-1"
                                    purpose="name"
                                    autoFocus
                                    aria-label="Recipe title"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <h1 className="text-xl font-semibold leading-snug">{recipe.title}</h1>
                                <div className="flex items-center gap-2">
                                    {recipe.link && (
                                        <a
                                            href={recipe.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
                                            aria-label="Open original recipe"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Recipe
                                        </a>
                                    )}
                                    {isOwner && !isSelectMode && (
                                        <>
                                            <button
                                                onClick={handleEditStart}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted transition-colors"
                                                aria-label="Edit recipe"
                                                type="button"
                                            >
                                                <Pencil className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={handleDeleteRecipe}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-destructive hover:bg-opacity-10 transition-colors text-destructive"
                                                aria-label="Delete recipe"
                                                type="button"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {isSelectMode ? (
                            <IngredientSelectSection
                                recipe={recipe}
                                lists={lists}
                                onCancel={() => setIsSelectMode(false)}
                                onConfirm={handleConfirmAddToList}
                            />
                        ) : (
                            <>
                                {isOwner && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                            Recipe Link
                                        </p>
                                        {isEditing ? (
                                            <Input
                                                type="url"
                                                value={editedLink}
                                                onChange={(e) => setEditedLink(e.target.value)}
                                                placeholder="https://..."
                                                className="flex-1"
                                                purpose="url"
                                            />
                                        ) : recipe.link ? (
                                            <p className="text-sm text-muted-foreground truncate">{recipe.link}</p>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No link added yet.</p>
                                        )}
                                        {!isEditing && recipe.attribution && (
                                            <p className="text-xs text-muted-foreground">{recipe.attribution}</p>
                                        )}
                                    </div>
                                )}

                                <RecipeDetailsSection
                                    prepTime={recipe.prepTime}
                                    cookTime={recipe.cookTime}
                                    servings={recipe.servings}
                                    difficulty={recipe.difficulty}
                                    isOwner={isOwner}
                                    isEditing={isEditing}
                                    editedPrepTime={editedPrepTime}
                                    editedCookTime={editedCookTime}
                                    editedServings={editedServings}
                                    editedDifficulty={editedDifficulty}
                                    onEditedPrepTimeChange={setEditedPrepTime}
                                    onEditedCookTimeChange={setEditedCookTime}
                                    onEditedServingsChange={setEditedServings}
                                    onEditedDifficultyChange={setEditedDifficulty}
                                />

                                <TagsSection
                                    tags={isEditing ? editedTags : (recipe.tags ?? [])}
                                    isOwner={isOwner}
                                    isEditing={isEditing}
                                    onChange={setEditedTags}
                                />

                                <IngredientsSection
                                    recipe={recipe}
                                    isOwner={isOwner}
                                    onUpdateIngredients={handleUpdateIngredients}
                                />

                                <InstructionsSection
                                    instructions={isEditing ? editedInstructions : (recipe.instructions ?? [])}
                                    isOwner={isOwner}
                                    isEditing={isEditing}
                                    onChange={setEditedInstructions}
                                />

                                {!isEditing && isOwner && <PublishSection recipe={recipe} />}

                                {isEditing && isOwner && (
                                    <div className="flex gap-2">
                                        <Button onClick={() => void handleSaveAll()}>Save</Button>
                                        <Button variant="outline" onClick={handleEditCancel}>
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <ToolBar
                onAddIngredient={isOwner ? handleAddIngredient : undefined}
                handleGoBack={handleGoBack}
                onToggleSelectMode={() => setIsSelectMode((v) => !v)}
                onManageRecipeUsers={isOwner ? () => setIsManageUsersOpen(true) : undefined}
            />

            {recipe && isOwner && (
                <ManageUsersDrawer
                    open={isManageUsersOpen}
                    onOpenChange={setIsManageUsersOpen}
                    title={recipe.title}
                    currentUsers={recipe.users}
                    ownerId={recipe.ownerId ?? ''}
                    currentUserId={user?.id ?? ''}
                    addUserMutation={addUserMutation}
                    removeUserMutation={removeUserMutation}
                    onUserAdded={() => void refetch()}
                    onUserRemoved={() => void refetch()}
                />
            )}

            <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmConfig?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{confirmConfig?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>
                            {confirmConfig?.cancelLabel || 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            {confirmConfig?.actionLabel || 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default RecipeDetailPage;
