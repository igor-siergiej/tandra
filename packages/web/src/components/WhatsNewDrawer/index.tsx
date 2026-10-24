import { format, parseISO } from 'date-fns';
import releaseNotes from '../../data/release-notes.json';
import { compareVersions } from '../../hooks/useLastSeenVersion';
import { PrivacyLink } from '../PrivacyLink';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '../ui/drawer';

type ReleaseNoteType = 'feature' | 'fix' | 'improvement';

interface ReleaseNote {
    type: ReleaseNoteType;
    text: string;
}

interface Release {
    version: string;
    date: string;
    notes: Array<ReleaseNote>;
}

const NOTE_LABELS: Record<ReleaseNoteType, string> = {
    feature: 'Added',
    fix: 'Fixed',
    improvement: 'Improved',
};

const NOTE_STYLES: Record<ReleaseNoteType, string> = {
    feature: 'bg-primary/10 text-primary',
    fix: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    improvement: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const releases = releaseNotes as Array<Release>;

interface WhatsNewDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Releases newer than this are flagged as unread. Null (a first-time
     * visitor, or storage unavailable) flags nothing.
     */
    highlightSince: string | null;
}

const WhatsNewDrawer = ({ open, onOpenChange, highlightSince }: WhatsNewDrawerProps) => (
    <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
            <div className="mx-auto flex w-full max-w-sm flex-col h-[70vh] max-h-[70vh]">
                <DrawerHeader className="flex-shrink-0">
                    <DrawerTitle>What's new</DrawerTitle>
                    <DrawerDescription>Everything that has shipped in Tandra</DrawerDescription>
                    <PrivacyLink />
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
                    {releases.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">No release notes yet</p>
                    )}
                    {releases.map((release) => {
                        const isUnread =
                            highlightSince !== null && compareVersions(release.version, highlightSince) > 0;

                        return (
                            <section key={release.version} className="space-y-2">
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-sm font-semibold">v{release.version}</h3>
                                    <span className="text-xs text-muted-foreground">
                                        {format(parseISO(release.date), 'd MMM yyyy')}
                                    </span>
                                    {isUnread && (
                                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                                            New
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2">
                                    {release.notes.map((note) => (
                                        <li key={note.text} className="flex gap-2 text-sm">
                                            <span
                                                className={`mt-0.5 h-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${NOTE_STYLES[note.type]}`}
                                            >
                                                {NOTE_LABELS[note.type]}
                                            </span>
                                            <span className="flex-1 text-foreground/90">{note.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                </div>
            </div>
        </DrawerContent>
    </Drawer>
);

export default WhatsNewDrawer;
