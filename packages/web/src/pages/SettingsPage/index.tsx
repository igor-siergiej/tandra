import { ArrowLeft } from 'lucide-react';
import { PrivacyLink } from '../../components/PrivacyLink';
import { useUnitSystem } from '../../contexts/UnitSystemContext';
import { useGoBack } from '../../hooks/useGoBack';
import { useKeepListening } from '../../hooks/useKeepListening';
import type { UnitSystem } from '../../utils/convertUnits';
import { AccountSection } from './AccountSection';

const UNIT_OPTIONS: Array<{ value: UnitSystem; label: string; hint: string }> = [
    { value: 'original', label: 'Original', hint: 'Keep amounts as written in the recipe' },
    { value: 'metric', label: 'Metric', hint: 'Convert imported amounts to g, kg, ml, l' },
    { value: 'imperial', label: 'Imperial', hint: 'Convert imported amounts to oz, lb, cups, tbsp, tsp' },
];

const SettingsPage = () => {
    const { unitSystem, setUnitSystem } = useUnitSystem();
    const [keepListening, setKeepListening] = useKeepListening();
    const handleGoBack = useGoBack('/');

    return (
        <div className="w-full space-y-6 py-4">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleGoBack}
                    aria-label="Go back"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-semibold text-foreground">Settings</h1>
            </div>

            <fieldset className="space-y-3">
                <legend className="space-y-1">
                    <span className="block text-sm font-semibold text-foreground">Units</span>
                    <span className="block text-sm text-muted-foreground">
                        How ingredient amounts are shown when you import a recipe from a link.
                    </span>
                </legend>

                <div className="flex flex-col gap-2">
                    {UNIT_OPTIONS.map((option) => {
                        const selected = unitSystem === option.value;
                        return (
                            <label
                                key={option.value}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                                    selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="unit-system"
                                    value={option.value}
                                    checked={selected}
                                    onChange={() => setUnitSystem(option.value)}
                                    className="mt-0.5 accent-primary"
                                />
                                <span className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Voice</h2>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-accent">
                    <input
                        type="checkbox"
                        checked={keepListening}
                        onChange={(event) => setKeepListening(event.target.checked)}
                        className="mt-0.5 accent-primary"
                    />
                    <span className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">Keep listening until I tap stop</span>
                        <span className="text-xs text-muted-foreground">
                            Voice input carries on through pauses instead of stopping when you go quiet.
                        </span>
                    </span>
                </label>
            </section>

            <AccountSection />

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">About</h2>
                <div className="rounded-xl border border-border px-4 py-3">
                    <PrivacyLink />
                </div>
            </section>
        </div>
    );
};

export default SettingsPage;
