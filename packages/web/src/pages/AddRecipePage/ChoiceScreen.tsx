import { ChefHat, Download } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter } from '../../components/ui/drawer';
import { useAiFeatures } from '../../utils/useAiFeatures';
import { AddRecipeHeader } from './AddRecipeHeader';

interface ChoiceScreenProps {
    onSelectImport: () => void;
    onSelectManual: () => void;
    onCancel: () => void;
}

// Rendered only while AddRecipePage's mode is 'choice', so it's mounted open for its whole
// lifetime; dismissing it (backdrop, swipe-down, or the footer Cancel) all route through
// onCancel the same way the header X used to.
export const ChoiceScreen = ({ onSelectImport, onSelectManual, onCancel }: ChoiceScreenProps) => {
    const { recipeImport } = useAiFeatures();
    return (
        <Drawer open onOpenChange={(open) => !open && onCancel()}>
            <DrawerContent>
                <div className="w-full sm:mx-auto sm:max-w-lg">
                    <AddRecipeHeader onCancel={onCancel} showCancel={false} />

                    <div className="space-y-3 p-4">
                        <button
                            type="button"
                            onClick={onSelectImport}
                            disabled={!recipeImport}
                            className="w-full flex items-center gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Download className="h-8 w-8 shrink-0 text-muted-foreground" />
                            <div>
                                <p className="font-semibold">Import from a link</p>
                                <p className="text-sm text-muted-foreground">
                                    {recipeImport
                                        ? "Paste a link and we'll fill in the details"
                                        : 'Not available on this server'}
                                </p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={onSelectManual}
                            className="w-full flex items-center gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
                        >
                            <ChefHat className="h-8 w-8 shrink-0 text-muted-foreground" />
                            <div>
                                <p className="font-semibold">Add manually</p>
                                <p className="text-sm text-muted-foreground">Start from a blank recipe</p>
                            </div>
                        </button>
                    </div>

                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};
