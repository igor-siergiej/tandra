import type { Recipe } from '@tandra/types';
import { useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import { useState } from 'react';

import { getPublishedRecipesQuery } from '../../api';
import { PublishDrawer } from '../../components/PublishControls/PublishDrawer';
import { UnpublishButton } from '../../components/PublishControls/UnpublishButton';
import { Button } from '../../components/ui/button';

// Owner-only. Imported recipes and copies from Discover hold somebody else's text, so they are told why instead of
// being offered the button (the server refuses them too).
export const PublishSection = ({ recipe }: { recipe: Recipe }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { data: published = [] } = useQuery(getPublishedRecipesQuery());
    const publication = published.find((ref) => ref.recipeId === recipe.id);

    if (recipe.link || recipe.attribution) {
        return (
            <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sharing publicly</p>
                <p className="text-sm text-muted-foreground">
                    Recipes imported from a link or copied from Discover can't be made public. Only recipes you wrote
                    yourself can be shared.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sharing publicly</p>
            {publication ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <Globe className="h-3.5 w-3.5" />
                        Public
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                        Update public copy
                    </Button>
                    <UnpublishButton libraryId={publication.libraryId} />
                </div>
            ) : (
                <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
                    <Globe className="h-4 w-4" />
                    Make public
                </Button>
            )}
            <PublishDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                recipeId={recipe.id}
                recipeTitle={recipe.title}
                isUpdate={!!publication}
            />
        </div>
    );
};
