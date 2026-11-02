export type UnitSystem = 'original' | 'metric' | 'imperial';

interface Measurement {
    quantity: number;
    unit: string;
}

type Dimension = 'mass' | 'volume';

type System = 'metric' | 'imperial';

interface UnitDef {
    dimension: Dimension;
    system: System;
    /** Factor to the dimension's metric base (mass → grams, volume → millilitres). */
    toBase: number;
    /** Canonical label emitted when converting *to* this unit. */
    label: string;
    /**
     * tsp/tbsp/cup are used regardless of measurement system, so they're excluded from
     * conversion entirely: never converted away from, never picked as a conversion target.
     */
    convertible?: boolean;
}

// Aliases are matched case-insensitively against the trimmed unit string with any
// trailing "s" and "." removed, so "Tbsp.", "tablespoons", "TBS" all resolve here.
const UNIT_TABLE = new Map<string, UnitDef>(
    Object.entries({
        g: { dimension: 'mass', system: 'metric', toBase: 1, label: 'g' },
        gram: { dimension: 'mass', system: 'metric', toBase: 1, label: 'g' },
        gm: { dimension: 'mass', system: 'metric', toBase: 1, label: 'g' },
        kg: { dimension: 'mass', system: 'metric', toBase: 1000, label: 'kg' },
        kilo: { dimension: 'mass', system: 'metric', toBase: 1000, label: 'kg' },
        kilogram: { dimension: 'mass', system: 'metric', toBase: 1000, label: 'kg' },
        oz: { dimension: 'mass', system: 'imperial', toBase: 28.349523125, label: 'oz' },
        ounce: { dimension: 'mass', system: 'imperial', toBase: 28.349523125, label: 'oz' },
        lb: { dimension: 'mass', system: 'imperial', toBase: 453.59237, label: 'lb' },
        lbs: { dimension: 'mass', system: 'imperial', toBase: 453.59237, label: 'lb' },
        pound: { dimension: 'mass', system: 'imperial', toBase: 453.59237, label: 'lb' },

        ml: { dimension: 'volume', system: 'metric', toBase: 1, label: 'ml' },
        milliliter: { dimension: 'volume', system: 'metric', toBase: 1, label: 'ml' },
        millilitre: { dimension: 'volume', system: 'metric', toBase: 1, label: 'ml' },
        cl: { dimension: 'volume', system: 'metric', toBase: 10, label: 'cl' },
        l: { dimension: 'volume', system: 'metric', toBase: 1000, label: 'l' },
        liter: { dimension: 'volume', system: 'metric', toBase: 1000, label: 'l' },
        litre: { dimension: 'volume', system: 'metric', toBase: 1000, label: 'l' },
        tsp: { dimension: 'volume', system: 'imperial', toBase: 4.92892159375, label: 'tsp', convertible: false },
        teaspoon: { dimension: 'volume', system: 'imperial', toBase: 4.92892159375, label: 'tsp', convertible: false },
        tbsp: { dimension: 'volume', system: 'imperial', toBase: 14.78676478125, label: 'tbsp', convertible: false },
        tbs: { dimension: 'volume', system: 'imperial', toBase: 14.78676478125, label: 'tbsp', convertible: false },
        tablespoon: {
            dimension: 'volume',
            system: 'imperial',
            toBase: 14.78676478125,
            label: 'tbsp',
            convertible: false,
        },
        cup: { dimension: 'volume', system: 'imperial', toBase: 236.5882365, label: 'cup', convertible: false },
        'fl oz': { dimension: 'volume', system: 'imperial', toBase: 29.5735295625, label: 'fl oz' },
        'fluid ounce': { dimension: 'volume', system: 'imperial', toBase: 29.5735295625, label: 'fl oz' },
        pint: { dimension: 'volume', system: 'imperial', toBase: 473.176473, label: 'pint' },
        quart: { dimension: 'volume', system: 'imperial', toBase: 946.352946, label: 'quart' },
    } satisfies Record<string, UnitDef>)
);

// When converting *into* a system, prefer these units (largest first) and pick the
// first that keeps the amount readable (>= 1, or the smallest unit as a last resort).
const PREFERRED: Record<System, Record<Dimension, string[]>> = {
    metric: { mass: ['kg', 'g'], volume: ['l', 'ml'] },
    imperial: { mass: ['lb', 'oz'], volume: ['quart', 'pint', 'fl oz'] },
};

const normalizeUnit = (unit: string): string => unit.trim().toLowerCase().replace(/\.$/, '').replace(/s$/, '') || '';

const lookupUnit = (unit: string | undefined): UnitDef | undefined => {
    if (!unit) return undefined;
    const key = normalizeUnit(unit);

    return UNIT_TABLE.get(key) ?? UNIT_TABLE.get(`${key}s`);
};

const roundQuantity = (value: number): number => {
    if (value >= 100) return Math.round(value);

    if (value >= 10) return Math.round(value * 2) / 2;

    if (value >= 1) return Math.round(value * 10) / 10;

    return Math.round(value * 100) / 100;
};

const hasUsableQuantity = (quantity: number | undefined): quantity is number =>
    quantity !== undefined && Number.isFinite(quantity) && quantity > 0;

// Pick the largest preferred unit that keeps the amount >= 1, falling back to the smallest.
const pickUnit = (base: number, candidateKeys: string[]): Measurement => {
    const defs = candidateKeys.flatMap((key) => {
        const def = UNIT_TABLE.get(key);

        return def ? [def] : [];
    });

    for (const def of defs) {
        if (base / def.toBase >= 1) {
            return { quantity: roundQuantity(base / def.toBase), unit: def.label };
        }
    }

    const smallest = defs.at(-1);

    if (!smallest) throw new Error('No preferred unit is configured for this dimension');

    return { quantity: roundQuantity(base / smallest.toBase), unit: smallest.label };
};

/**
 * Convert a single quantity+unit into the target system. Returns null when the unit
 * is unknown, dimensionless (e.g. "clove", "pinch"), or already in the target system.
 */
const canConvertTo = (def: UnitDef, target: System): boolean => def.system !== target && def.convertible !== false;

const convertMeasurement = (
    quantity: number | undefined,
    unit: string | undefined,
    target: System
): Measurement | null => {
    const def = lookupUnit(unit);

    if (!hasUsableQuantity(quantity) || !def || !canConvertTo(def, target)) return null;

    return pickUnit(quantity * def.toBase, PREFERRED[target][def.dimension]);
};

interface ConvertibleIngredient {
    name: string;
    quantity?: number;
    unit?: string;
}

/**
 * Map ingredients into the preferred unit system. `original` is a no-op; anything
 * that can't be confidently converted (unknown unit, no quantity, already in system)
 * is passed through untouched.
 */
export const convertIngredients = <T extends ConvertibleIngredient>(ingredients: T[], system: UnitSystem): T[] => {
    if (system === 'original') return ingredients;

    return ingredients.map((ingredient) => {
        const converted = convertMeasurement(ingredient.quantity, ingredient.unit, system);

        return converted ? { ...ingredient, quantity: converted.quantity, unit: converted.unit } : ingredient;
    });
};

/**
 * Scale each ingredient's quantity by `multiplier` (e.g. for a portions stepper).
 * A multiplier of 1 is a no-op (same reference back); ingredients with no quantity
 * are passed through untouched.
 */
export const scaleIngredients = <T extends ConvertibleIngredient>(ingredients: T[], multiplier: number): T[] => {
    if (multiplier === 1) return ingredients;

    return ingredients.map((ingredient) =>
        ingredient.quantity === undefined
            ? ingredient
            : { ...ingredient, quantity: roundQuantity(ingredient.quantity * multiplier) }
    );
};
