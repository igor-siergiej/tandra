import type { Recipe, RecipeDifficulty } from '@tandra/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
    generateRecipeAiImage,
    getListsQuery,
    getRecipeQuery,
    getRecipesQuery,
    importRecipe,
    uploadRecipeImage,
} from '../../api';
import { useUser } from '../../auth';
import { FriendPicker } from '../../components/FriendPicker';
import { RecipeTimingFields } from '../../components/RecipeTimingFields';
import { StepsList } from '../../components/StepsList';
import { TagsField } from '../../components/TagsField';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useUnitSystem } from '../../contexts/UnitSystemContext';
import { useRecipeMutations } from '../../hooks/useRecipeMutations';
import { track } from '../../utils/analytics';
import { logger } from '../../utils/logger';
import { toOptionalNumber } from '../../utils/parseRecipeMeta';
import { splitIntoSteps } from '../../utils/splitIntoSteps';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/toast';
import { AddIngredientsFromListDrawer } from './AddIngredientsFromListDrawer';
import { AddRecipeHeader } from './AddRecipeHeader';
import { applyImportedDraft } from './applyImportedDraft';
import { ChoiceScreen } from './ChoiceScreen';
import { FormSection } from './FormSection';
import { ImageUploadField } from './ImageUploadField';
import { ImportProgress, type ImportStage } from './ImportProgress';
import { ImportScreen } from './ImportScreen';
import { type Ingredient, IngredientsField } from './IngredientsField';
import { LinkImportField } from './LinkImportField';

type Mode = 'choice' | 'import' | 'form';

const notifyImportResult = (foundCount: number): void => {
    if (foundCount === 0) {
        notifyWarning('Couldn’t find recipe details — fill them in manually');
    } else {
        notifySuccess('Recipe imported — review and edit before saving');
    }
};

// Extensive per-field state (title/image/link/ingredients/instructions/import status) backs a
// single 3-mode (choice/import/form) flow; JSX sections and the import/create/submit logic are
// already split into sibling components and helpers — the remaining hook count reflects the
// form's genuine field count, not unsplit logic.
// fallow-ignore-next-line complexity
const AddRecipePage = () => {
    const recipeNameId = useId();
    const prepTimeId = useId();
    const cookTimeId = useId();
    const servingsId = useId();
    const difficultyId = useId();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useUser();
    const queryClient = useQueryClient();
    const { createRecipe } = useRecipeMutations(user ?? undefined);

    const { refetch } = useQuery({
        ...getRecipesQuery(user?.id || ''),
        enabled: false,
    });

    const { data: lists = [] } = useQuery(
        user?.id ? getListsQuery(user.id) : { queryKey: [], queryFn: async () => [] }
    );

    const initialLink = searchParams.get('sharedUrl') ?? '';
    const autoImport = !!initialLink;

    const [mode, setMode] = useState<Mode>(autoImport ? 'form' : 'choice');
    // Title autoFocus only fires when the user explicitly chose manual entry (no imported
    // content to hide behind the keyboard) — never for a completed URL/share-target import,
    // which already populated the form and would just yank the user back to the top.
    const [titleAutoFocus, setTitleAutoFocus] = useState(false);
    const modeRef = useRef<Mode>(mode);
    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    const { unitSystem } = useUnitSystem();
    const unitSystemRef = useRef(unitSystem);
    useEffect(() => {
        unitSystemRef.current = unitSystem;
    }, [unitSystem]);

    const [title, setTitle] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [link, setLink] = useState(initialLink);
    const [instructionsPasteText, setInstructionsPasteText] = useState('');
    const [steps, setSteps] = useState<string[]>([]);
    const [showPasteArea, setShowPasteArea] = useState(true);
    const [ingredientsPasteText, setIngredientsPasteText] = useState('');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [showIngredientsPaste, setShowIngredientsPaste] = useState(true);
    const [tags, setTags] = useState<string[]>([]);
    const [importStage, setImportStage] = useState<ImportStage>('idle');
    const [importError, setImportError] = useState('');
    const [prepTime, setPrepTime] = useState('');
    const [cookTime, setCookTime] = useState('');
    const [servings, setServings] = useState('');
    const [difficulty, setDifficulty] = useState<'' | RecipeDifficulty>('');
    const autoImportedRef = useRef(false);
    const importAbortRef = useRef<AbortController | null>(null);
    const isImporting = importStage !== 'idle';

    // Validate → abort-controller setup → try/catch/finally around the fetch; the soft-fail abort
    // check and the mode-transition guard are both load-bearing and already factored out from the
    // draft-application logic (see applyImportedDraft.ts) and the toast copy (notifyImportResult).
    // fallow-ignore-next-line complexity
    const handleImport = useCallback(async (importUrl: string) => {
        const target = importUrl.trim();

        if (!target) {
            notifyError('Enter a recipe link to import');

            return;
        }

        const controller = new AbortController();
        importAbortRef.current = controller;
        setImportStage('fetching');
        setError('');
        setImportError('');
        track('recipe_import_started', { source: 'link' });

        try {
            const draft = await importRecipe(target, controller.signal);

            await applyImportedDraft(
                draft,
                {
                    setTitle,
                    setLink,
                    setIngredients,
                    setShowIngredientsPaste,
                    setSteps,
                    setShowPasteArea,
                    setSelectedFile,
                    setImageUrl,
                    setPrepTime,
                    setCookTime,
                    setServings,
                },
                unitSystemRef.current,
                { signal: controller.signal, onImageStart: () => setImportStage('image') }
            );

            notifyImportResult(draft.ingredients.length + draft.instructions.length);

            if (modeRef.current === 'import') {
                setMode('form');
            }
        } catch (err) {
            if (controller.signal.aborted) {
                return;
            }

            const message = err instanceof Error ? err.message : 'Failed to import recipe';
            setImportError(message);
            notifyError(message);
        } finally {
            importAbortRef.current = null;
            setImportStage('idle');
        }
    }, []);

    const handleCancelImport = () => {
        importAbortRef.current?.abort();
    };

    // Share-target flow: run the import automatically once when landing here with a shared link.
    useEffect(() => {
        if (autoImport && initialLink && !autoImportedRef.current) {
            autoImportedRef.current = true;
            void handleImport(initialLink);
        }
    }, [autoImport, initialLink, handleImport]);

    // Sequential create/upload/refetch/AI-image steps; each step depends on the previous one's
    // result, so splitting further would obscure the flow, not clarify it.
    // fallow-ignore-next-line complexity
    const handleAddRecipe = async (
        recipeTitle: string,
        recipeIngredients: Ingredient[],
        selUsers?: string[],
        recipeLink?: string,
        instructions?: string[],
        imageFile?: File,
        recipeTags?: string[],
        recipePrepTime?: number,
        recipeCookTime?: number,
        recipeServings?: number,
        recipeDifficulty?: RecipeDifficulty
    ): Promise<Recipe | undefined> => {
        if (!user) {
            logger.warn('Attempted to add recipe without user');

            return undefined;
        }

        try {
            const recipeId = await createRecipe(
                recipeTitle,
                selUsers || [],
                recipeIngredients,
                recipeLink,
                instructions,
                recipeTags,
                recipePrepTime,
                recipeCookTime,
                recipeServings,
                recipeDifficulty
            );

            logger.info('Recipe created successfully', { title: recipeTitle, recipeId });

            if (imageFile) {
                await uploadRecipeImage(recipeId, imageFile);
                await queryClient.invalidateQueries({ queryKey: getRecipeQuery(recipeId).queryKey });
            }

            await refetch();

            if (!imageFile) {
                void generateRecipeAiImage(recipeId).then((updatedRecipe) => {
                    queryClient.setQueryData(getRecipeQuery(recipeId).queryKey, updatedRecipe);

                    return queryClient.invalidateQueries({ queryKey: getRecipesQuery(user.id).queryKey });
                });
            }

            const recipes = queryClient.getQueryData<Recipe[]>(['recipes', user.id]) ?? [];

            return recipes.find((r) => r.id === recipeId);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('Failed to create recipe', { title: recipeTitle, error: message });
            throw err;
        }
    };

    const handleCancel = () => {
        navigate('/recipes');
    };

    if (mode === 'choice') {
        return (
            <ChoiceScreen
                onSelectImport={() => setMode('import')}
                onSelectManual={() => {
                    setTitleAutoFocus(true);
                    setMode('form');
                }}
                onCancel={handleCancel}
            />
        );
    }

    if (mode === 'import') {
        return (
            <ImportScreen
                link={link}
                setLink={setLink}
                importStage={importStage}
                importError={importError}
                onImport={() => void handleImport(link)}
                onCancelImport={handleCancelImport}
                onSwitchToManual={() => {
                    handleCancelImport();
                    setImportError('');
                    setTitleAutoFocus(true);
                    setMode('form');
                }}
                onCancel={handleCancel}
            />
        );
    }

    // Sequential validate/create/toast/navigate steps for the submit flow; extracting further
    // would scatter one linear user action across several files.
    // fallow-ignore-next-line complexity
    const handleSubmit = async () => {
        if (!title.trim()) {
            setError('Recipe title is required');

            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const recipe = await handleAddRecipe(
                title,
                ingredients
                    .filter((ingredient) => ingredient.name.trim())
                    .map((ingredient) => ({ ...ingredient, name: ingredient.name.trim() })),
                selectedUsers,
                link.trim() || undefined,
                steps.length > 0 ? steps : undefined,
                selectedFile || undefined,
                tags.length > 0 ? tags : undefined,
                toOptionalNumber(prepTime),
                toOptionalNumber(cookTime),
                toOptionalNumber(servings),
                difficulty || undefined
            );

            if (!recipe) {
                throw new Error('Failed to create recipe');
            }

            track('recipe_saved', { source: link.trim() ? 'link' : 'manual' });
            navigate('/recipes');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create recipe';
            notifyError(message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <AddRecipeHeader onCancel={handleCancel} disabled={isLoading} />

            <div className="flex-1 overflow-y-auto px-4">
                <div className="space-y-4 py-4 max-w-lg mx-auto w-full">
                    <FormSection title="Photo">
                        <ImageUploadField
                            imageUrl={imageUrl}
                            disabled={isLoading}
                            onFileSelected={setSelectedFile}
                            onPreviewReady={setImageUrl}
                            onClear={() => {
                                setImageUrl(null);
                                setSelectedFile(null);
                            }}
                        />
                    </FormSection>

                    <FormSection title="Basics">
                        <div className="space-y-2">
                            <Label htmlFor={recipeNameId}>Recipe Title</Label>
                            <Input
                                id={recipeNameId}
                                type="search"
                                name="recipe-title"
                                placeholder="Enter recipe title..."
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    setError('');
                                }}
                                disabled={isLoading}
                                autoFocus={titleAutoFocus}
                                autoComplete="off"
                                inputMode="text"
                                className="h-12 border border-foreground/30 text-base"
                            />
                        </div>

                        <RecipeTimingFields
                            prepTimeId={prepTimeId}
                            cookTimeId={cookTimeId}
                            servingsId={servingsId}
                            difficultyId={difficultyId}
                            prepTime={prepTime}
                            cookTime={cookTime}
                            servings={servings}
                            difficulty={difficulty}
                            onPrepTimeChange={setPrepTime}
                            onCookTimeChange={setCookTime}
                            onServingsChange={setServings}
                            onDifficultyChange={setDifficulty}
                            disabled={isLoading}
                        />

                        <LinkImportField
                            link={link}
                            setLink={setLink}
                            isImporting={isImporting}
                            importError={importError}
                            disabled={isLoading}
                            onImport={() => void handleImport(link)}
                            onCancelImport={handleCancelImport}
                        />
                    </FormSection>

                    <FormSection title="Ingredients">
                        <IngredientsField
                            ingredients={ingredients}
                            ingredientsPasteText={ingredientsPasteText}
                            setIngredientsPasteText={setIngredientsPasteText}
                            showIngredientsPaste={showIngredientsPaste}
                            setShowIngredientsPaste={setShowIngredientsPaste}
                            onChange={setIngredients}
                            disabled={isLoading}
                            isImporting={isImporting}
                        />
                        <AddIngredientsFromListDrawer
                            lists={lists}
                            disabled={isLoading}
                            onAdd={(picked) => {
                                setIngredients((prev) => [...prev, ...picked]);
                                setShowIngredientsPaste(false);
                            }}
                        />
                    </FormSection>

                    <FormSection title="Instructions">
                        <div className="space-y-2">
                            {steps.length > 0 && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowPasteArea(true)}
                                        className="text-xs text-muted-foreground underline"
                                    >
                                        edit text ↩
                                    </button>
                                </div>
                            )}
                            {showPasteArea || steps.length === 0 ? (
                                <Textarea
                                    placeholder="Paste instructions here — each line becomes a step automatically..."
                                    value={instructionsPasteText}
                                    onChange={(e) => setInstructionsPasteText(e.target.value)}
                                    onBlur={() => {
                                        const parsed = splitIntoSteps(instructionsPasteText);

                                        if (parsed.length > 0) {
                                            setSteps(parsed);
                                            setShowPasteArea(false);
                                        }
                                    }}
                                    disabled={isLoading || isImporting}
                                    name="recipe-instructions"
                                    autoComplete="off"
                                    inputMode="text"
                                    className="min-h-[100px] resize-none border border-foreground/30 text-base"
                                />
                            ) : (
                                <StepsList steps={steps} onChange={setSteps} disabled={isLoading} />
                            )}
                        </div>
                    </FormSection>

                    <FormSection title="Tags">
                        <TagsField tags={tags} onChange={setTags} disabled={isLoading} />
                    </FormSection>

                    <FormSection title="Share">
                        <FriendPicker value={selectedUsers} onChange={setSelectedUsers} seedAllByDefault />
                    </FormSection>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            </div>

            <div className="sticky bottom-0 bg-background border-t px-4 py-3 flex flex-col gap-2 max-w-lg mx-auto w-full">
                {/* Pinned above the submit actions so an in-flight import (including the
                    share-target auto-import, which lands straight on this form) stays
                    visible wherever the user has scrolled to. */}
                <ImportProgress stage={importStage} />
                <Button onClick={() => void handleSubmit()} disabled={isLoading || !title.trim()}>
                    {isLoading ? 'Creating...' : 'Create Recipe'}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                    Cancel
                </Button>
            </div>
        </div>
    );
};

export default AddRecipePage;
