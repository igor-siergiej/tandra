import type { RecipeDifficulty } from '@tandra/types';
import { useId } from 'react';

import { RecipeTimingFields } from '../../components/RecipeTimingFields';

interface RecipeDetails {
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: RecipeDifficulty;
}

interface RecipeDetailsSectionProps extends RecipeDetails {
    isOwner?: boolean | null;
    isEditing: boolean;
    editedPrepTime: string;
    editedCookTime: string;
    editedServings: string;
    editedDifficulty: '' | RecipeDifficulty;
    onEditedPrepTimeChange: (value: string) => void;
    onEditedCookTimeChange: (value: string) => void;
    onEditedServingsChange: (value: string) => void;
    onEditedDifficultyChange: (value: RecipeDifficulty) => void;
}

const DIFFICULTY_LABEL: Record<RecipeDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

// fallow-ignore-next-line complexity
const RecipeDetailsChips = ({ prepTime, cookTime, servings, difficulty }: RecipeDetails) => (
    <div className="flex flex-wrap gap-2 text-sm">
        {prepTime !== undefined && (
            <span className="rounded-full border border-border px-2.5 py-0.5">Prep: {prepTime} min</span>
        )}
        {cookTime !== undefined && (
            <span className="rounded-full border border-border px-2.5 py-0.5">Cook: {cookTime} min</span>
        )}
        {servings !== undefined && (
            <span className="rounded-full border border-border px-2.5 py-0.5">Servings: {servings}</span>
        )}
        {difficulty && (
            <span className="rounded-full border border-border px-2.5 py-0.5">
                Difficulty: {DIFFICULTY_LABEL[difficulty]}
            </span>
        )}
    </div>
);

// View/edit toggle for prep/cook time, servings and difficulty; edit mode (and the edited field
// values themselves) is now externally controlled by the page's single Edit/Save/Cancel, mirroring
// InstructionsSection. Viewers with nothing to show see nothing; owners see a chip row or, while
// editing, the same RecipeTimingFields group AddRecipePage's manual form uses.
// fallow-ignore-next-line complexity
export const RecipeDetailsSection = ({
    prepTime,
    cookTime,
    servings,
    difficulty,
    isOwner,
    isEditing,
    editedPrepTime,
    editedCookTime,
    editedServings,
    editedDifficulty,
    onEditedPrepTimeChange,
    onEditedCookTimeChange,
    onEditedServingsChange,
    onEditedDifficultyChange,
}: RecipeDetailsSectionProps) => {
    const prepTimeId = useId();
    const cookTimeId = useId();
    const servingsId = useId();
    const difficultyId = useId();
    const hasAnyDetail = prepTime !== undefined || cookTime !== undefined || servings !== undefined || !!difficulty;

    if (!isEditing) {
        if (!hasAnyDetail) return null;

        return (
            <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Details</p>
                <RecipeDetailsChips
                    prepTime={prepTime}
                    cookTime={cookTime}
                    servings={servings}
                    difficulty={difficulty}
                />
            </div>
        );
    }

    if (!isOwner) return null;

    return (
        <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Details</p>
            <RecipeTimingFields
                prepTimeId={prepTimeId}
                cookTimeId={cookTimeId}
                servingsId={servingsId}
                difficultyId={difficultyId}
                prepTime={editedPrepTime}
                cookTime={editedCookTime}
                servings={editedServings}
                difficulty={editedDifficulty}
                onPrepTimeChange={onEditedPrepTimeChange}
                onCookTimeChange={onEditedCookTimeChange}
                onServingsChange={onEditedServingsChange}
                onDifficultyChange={onEditedDifficultyChange}
            />
        </div>
    );
};
