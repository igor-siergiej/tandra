import type { DiscoveryRecipe, DiscoveryRecipeSummary, Ingredient } from '@tandra/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Plus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
    copyDiscoveryRecipe,
    getDiscoveryRecipeQuery,
    getPublishedRecipesQuery,
    getRecipesQuery,
    getSimilarDiscoveryRecipesQuery,
} from '../../api';
import { useUser } from '../../auth';
import { DiscoveryCover } from '../../components/DiscoveryCover';
import { DiscoveryMeta, ESTIMATE_LEGEND, hasEstimates } from '../../components/DiscoveryMeta';
import { ReportButton } from '../../components/PublishControls/ReportButton';
import { UnpublishButton } from '../../components/PublishControls/UnpublishButton';
import ToolBar from '../../components/ToolBar';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';

const NOT_FOUND = 404;

const formatIngredient = ({ name, quantity, unit }: Ingredient): string => {
    // "pcs" is the structurer's marker for a bare count ("2 eggs"), not something a person would write.
    const measure = [quantity, unit && unit !== 'pcs' ? unit : undefined].filter((part) => part !== undefined);
    return [...measure, name].join(' ');
};

const SimilarStrip = ({ recipes, onSelect }: { recipes: DiscoveryRecipeSummary[]; onSelect: (id: string) => void }) => {
    if (recipes.length === 0) return null;
    return (
        <section aria-label="Similar recipes" className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Similar recipes</h3>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {recipes.map((recipe) => (
                    <button
                        key={recipe.id}
                        type="button"
                        onClick={() => onSelect(recipe.id)}
                        className="w-44 flex-shrink-0 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                    >
                        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                            {recipe.title}
                        </span>
                        <span className="mt-1.5 block">
                            <DiscoveryMeta recipe={recipe} />
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
};

// Four add states (add, adding, added, already have) plus the failure message.
// fallow-ignore-next-line complexity
const AddButton = ({ recipe }: { recipe: DiscoveryRecipe }) => {
    const { user } = useUser();
    const queryClient = useQueryClient();
    const recipesKey = getRecipesQuery(user?.id ?? '').queryKey;
    const { data: mine = [] } = useQuery({ ...getRecipesQuery(user?.id ?? ''), enabled: !!user?.id });

    const add = useMutation({
        mutationFn: () => copyDiscoveryRecipe(recipe.id),
        onSettled: () => queryClient.invalidateQueries({ queryKey: recipesKey }),
    });

    // The copy keeps the source page as its link, which is how an earlier copy (or a URL import of the same page) is found.
    const existing = add.data ?? mine.find((candidate) => candidate.link === recipe.sourceUrl);

    if (existing) {
        return (
            <div className="flex items-center gap-3">
                <Button disabled className="flex-1">
                    <Check className="h-4 w-4" />
                    {add.data ? 'Added to your recipes' : 'Already in your recipes'}
                </Button>
                <Link to={`/recipes/${existing.id}`} className="text-sm text-primary underline">
                    View
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <Button className="w-full" disabled={add.isPending} onClick={() => add.mutate()}>
                <Plus className="h-4 w-4" />
                {add.isPending ? 'Adding...' : 'Add to my recipes'}
            </Button>
            {add.isError && (
                <p role="alert" className="text-xs text-destructive">
                    Could not add this recipe. Please try again.
                </p>
            )}
        </div>
    );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {children}
    </section>
);

// Whoever published a recipe can take it down from here (also after deleting their private recipe, when this is the
// only place left that shows it); everybody else can report it.
const PublicRecipeActions = ({ recipe }: { recipe: DiscoveryRecipe }) => {
    const navigate = useNavigate();
    const { data: published = [] } = useQuery(getPublishedRecipesQuery());
    const isMine = recipe.source === 'user' && published.some((ref) => ref.libraryId === recipe.id);

    return (
        <div className="flex items-center justify-between">
            {isMine ? (
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">Your public recipe</span>
                    <UnpublishButton libraryId={recipe.id} onUnpublished={() => navigate('/discover')} />
                </div>
            ) : (
                <ReportButton recipeId={recipe.id} />
            )}
        </div>
    );
};

// Preview sections, each shown only when the recipe has that content.
// fallow-ignore-next-line complexity
const RecipePreview = ({
    recipe,
    onSelectSimilar,
}: {
    recipe: DiscoveryRecipe;
    onSelectSimilar: (id: string) => void;
}) => {
    const { data: similar = [] } = useQuery(getSimilarDiscoveryRecipesQuery(recipe.id));

    return (
        <div className="space-y-5">
            {/* No wrapper at all without a cover: an empty one would still add a gap above the title. */}
            {recipe.coverImageKey && (
                <div className="space-y-1">
                    <DiscoveryCover
                        imageKey={recipe.coverImageKey}
                        title={recipe.title}
                        className="h-48 w-full rounded-2xl"
                    />
                    {recipe.coverImageAttribution && (
                        <p className="text-[11px] text-muted-foreground">
                            {recipe.coverImageSourceUrl ? (
                                <a
                                    href={recipe.coverImageSourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    {recipe.coverImageAttribution}
                                </a>
                            ) : (
                                recipe.coverImageAttribution
                            )}
                        </p>
                    )}
                </div>
            )}
            <div className="space-y-2">
                <h2 className="text-xl font-semibold leading-tight text-foreground">{recipe.title}</h2>
                {recipe.publishedBy && <p className="text-xs text-muted-foreground">Shared by {recipe.publishedBy}</p>}
                <DiscoveryMeta recipe={recipe} />
                {hasEstimates(recipe) && <p className="text-xs text-muted-foreground">{ESTIMATE_LEGEND}</p>}
                {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {recipe.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <AddButton recipe={recipe} />

            <Section title="Ingredients">
                <ul className="space-y-1">
                    {recipe.ingredients.map((ingredient) => (
                        <li
                            key={ingredient.id}
                            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                        >
                            {formatIngredient(ingredient)}
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Instructions">
                <ol className="space-y-1">
                    {recipe.instructions.map((step, index) => (
                        <li
                            key={`${index}-${step.slice(0, 20)}`}
                            className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                        >
                            <span className="min-w-[1.25rem] font-semibold text-muted-foreground">{index + 1}.</span>
                            <span className="text-foreground">{step}</span>
                        </li>
                    ))}
                </ol>
            </Section>

            <section aria-label="Source" className="space-y-1 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                <p>{recipe.attribution}</p>
                <p>Licence: {recipe.licence}</p>
                {/* A user recipe's "source" is this very page, so there is no original to link to. */}
                {recipe.source !== 'user' && (
                    <a
                        href={recipe.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline"
                    >
                        View the original recipe
                        <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </section>

            <PublicRecipeActions recipe={recipe} />

            <SimilarStrip recipes={similar} onSelect={onSelectSimilar} />
        </div>
    );
};

const Problem = ({ notFound, onRetry }: { notFound: boolean; onRetry: () => void }) => (
    <div role="alert" className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-semibold">{notFound ? 'Recipe not found' : 'Unable to load this recipe'}</span>
        </div>
        <p className="mb-4 max-w-sm text-muted-foreground">
            {notFound ? 'It is no longer in the library.' : 'Please check your connection and try again.'}
        </p>
        {!notFound && <Button onClick={onRetry}>Retry</Button>}
    </div>
);

// Full-page preview of one library recipe: everything needed to decide, then one tap to make it yours.
// Loading, error, not-found and loaded branches of one page.
// fallow-ignore-next-line complexity
const DiscoverRecipePage = () => {
    const { recipeId = '' } = useParams<{ recipeId: string }>();
    const navigate = useNavigate();
    const { data: recipe, isLoading, isError, error, refetch } = useQuery(getDiscoveryRecipeQuery(recipeId));

    let body: React.ReactNode;
    if (isError) {
        body = (
            <Problem
                notFound={(error as { status?: number } | null)?.status === NOT_FOUND}
                onRetry={() => void refetch()}
            />
        );
    } else if (isLoading || !recipe) {
        body = <Skeleton className="h-64 w-full rounded-2xl" />;
    } else {
        body = <RecipePreview recipe={recipe} onSelectSimilar={(id) => navigate(`/discover/${id}`)} />;
    }

    return (
        <>
            <div className="space-y-3 pb-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/discover')} className="-ml-2">
                    <ArrowLeft className="h-4 w-4" />
                    Discover
                </Button>
                {body}
            </div>
            <ToolBar />
        </>
    );
};

export default DiscoverRecipePage;
