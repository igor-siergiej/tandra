import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { getPublishedRecipesQuery, publishRecipe } from '../../api';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { Label } from '../ui/label';

interface PublishDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recipeId: string;
    recipeTitle: string;
    /** The recipe is already public: publishing again replaces the public copy with the current version. */
    isUpdate: boolean;
}

const errorMessage = (error: unknown): string =>
    (error as { message?: string } | null)?.message || 'Could not make this recipe public. Please try again.';

// The licence step: nothing is sent until the user has ticked that they wrote the recipe and accept CC BY-SA 4.0.
// Both boxes start unticked, including "show my name", so the safe choice is what you get by default.
// Licence form: two checkboxes, submit state, error state and reset on close.
// fallow-ignore-next-line complexity
export const PublishDrawer = ({ open, onOpenChange, recipeId, recipeTitle, isUpdate }: PublishDrawerProps) => {
    const queryClient = useQueryClient();
    const [agreed, setAgreed] = useState(false);
    const [showName, setShowName] = useState(false);
    const agreeId = useId();
    const showNameId = useId();

    const publish = useMutation({
        mutationFn: () => publishRecipe(recipeId, { agreeToLicence: agreed, showName }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: getPublishedRecipesQuery().queryKey });
            onOpenChange(false);
        },
    });

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setAgreed(false);
            setShowName(false);
            publish.reset();
        }
        onOpenChange(next);
    };

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>{isUpdate ? 'Update public recipe' : 'Make recipe public'}</DrawerTitle>
                        <DrawerDescription>{recipeTitle}</DrawerDescription>
                    </DrawerHeader>

                    <div className="space-y-4 px-4 pb-2 text-sm">
                        <p className="text-muted-foreground">
                            Everyone using Tandra will be able to find, read and copy this recipe. Only a snapshot is
                            shared: your friends list, who you share this recipe with and later edits stay private
                            {isUpdate ? '. Publishing again replaces the public copy with the current version' : ''}.
                        </p>

                        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                            Published under <strong className="text-foreground">CC BY-SA 4.0</strong>: anyone may share
                            and adapt it, even commercially, if they credit you and share their changes under the same
                            licence. You can unpublish at any time; copies people already made stay theirs.
                        </div>

                        <div className="flex items-start gap-3">
                            <Checkbox
                                id={agreeId}
                                checked={agreed}
                                onCheckedChange={(checked) => setAgreed(checked === true)}
                            />
                            <Label htmlFor={agreeId} className="text-sm font-normal leading-snug">
                                I wrote this recipe myself and agree to share it under CC BY-SA 4.0
                            </Label>
                        </div>

                        <div className="flex items-start gap-3">
                            <Checkbox
                                id={showNameId}
                                checked={showName}
                                onCheckedChange={(checked) => setShowName(checked === true)}
                            />
                            <Label htmlFor={showNameId} className="text-sm font-normal leading-snug">
                                Show my username as the author
                            </Label>
                        </div>

                        {publish.isError && (
                            <p role="alert" className="text-xs text-destructive">
                                {errorMessage(publish.error)}
                            </p>
                        )}
                    </div>

                    <DrawerFooter>
                        <Button disabled={!agreed || publish.isPending} onClick={() => publish.mutate()}>
                            {publish.isPending ? 'Publishing...' : isUpdate ? 'Update public recipe' : 'Make public'}
                        </Button>
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
