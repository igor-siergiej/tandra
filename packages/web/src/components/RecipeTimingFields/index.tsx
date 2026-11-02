import type { RecipeDifficulty } from '@tandra/types';

import { TimeField } from '../TimeField';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface RecipeTimingFieldsProps {
    prepTimeId: string;
    cookTimeId: string;
    servingsId: string;
    difficultyId: string;
    prepTime: string;
    cookTime: string;
    servings: string;
    difficulty: '' | RecipeDifficulty;
    onPrepTimeChange: (value: string) => void;
    onCookTimeChange: (value: string) => void;
    onServingsChange: (value: string) => void;
    onDifficultyChange: (value: RecipeDifficulty) => void;
    disabled?: boolean;
}

// Prep time / cook time / servings / difficulty field group, shared by AddRecipePage's manual
// entry form and RecipeDetailsSection's edit mode so the two stay in lockstep instead of
// drifting as separate copies.
// SAFETY: the Select only offers the RecipeDifficulty values.
export const RecipeTimingFields = ({
    prepTimeId,
    cookTimeId,
    servingsId,
    difficultyId,
    prepTime,
    cookTime,
    servings,
    difficulty,
    onPrepTimeChange,
    onCookTimeChange,
    onServingsChange,
    onDifficultyChange,
    disabled,
}: RecipeTimingFieldsProps) => (
    <div className="grid grid-cols-2 gap-4">
        <TimeField
            id={prepTimeId}
            label="Prep time"
            value={prepTime}
            onChange={onPrepTimeChange}
            suffix="min"
            disabled={disabled}
        />
        <TimeField
            id={cookTimeId}
            label="Cook time"
            value={cookTime}
            onChange={onCookTimeChange}
            suffix="min"
            disabled={disabled}
        />
        <TimeField id={servingsId} label="Servings" value={servings} onChange={onServingsChange} disabled={disabled} />
        <div>
            <Label htmlFor={difficultyId}>Difficulty</Label>
            <Select value={difficulty} onValueChange={(value) => onDifficultyChange(value as RecipeDifficulty)}>
                <SelectTrigger id={difficultyId} className="mt-2 border border-foreground/30">
                    <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </div>
);
