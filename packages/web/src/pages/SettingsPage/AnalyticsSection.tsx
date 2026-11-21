import { AnalyticsStorageWarning } from '../../components/AnalyticsConsentPrompt/StorageWarning';
import { Switch } from '../../components/ui/switch';
import { useAnalyticsConsent } from '../../hooks/useAnalyticsConsent';

interface ToggleRowProps {
    id: string;
    label: string;
    hint: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

const ToggleRow = ({ id, label, hint, checked, onCheckedChange }: ToggleRowProps) => (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
        <div className="flex flex-col">
            <label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
                {label}
            </label>
            <span id={`${id}-hint`} className="text-xs text-muted-foreground">
                {hint}
            </span>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-describedby={`${id}-hint`} />
    </div>
);

export const AnalyticsSection = () => {
    const { usageEnabled, recordingsEnabled, setUsageEnabled, setRecordingsEnabled } = useAnalyticsConsent();

    return (
        <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Privacy</h2>
            <ToggleRow
                id="analytics-usage"
                label="Usage statistics"
                hint="Anonymous counts of which features get used, so we know what to improve. No list, item or recipe text is sent."
                checked={usageEnabled}
                onCheckedChange={setUsageEnabled}
            />
            <ToggleRow
                id="analytics-recordings"
                label="Help improve Tandra with session recordings"
                hint="Record how you use the app on this device to spot what is confusing. Off unless you turn it on."
                checked={recordingsEnabled}
                onCheckedChange={setRecordingsEnabled}
            />
            <AnalyticsStorageWarning />
        </section>
    );
};
