import type { Viewer } from '../../realtime/listSocket';

const describeViewers = (viewers: Viewer[]): string => {
    const names = viewers.map((viewer) => viewer.username);

    if (names.length === 1) return `${names[0]} is also viewing this list`;

    if (names.length === 2) return `${names[0]} and ${names[1]} are also viewing this list`;

    return `${names[0]}, ${names[1]} and ${names.length - 2} more are also viewing this list`;
};

export const ViewerBanner = ({ viewers }: { viewers: Viewer[] }) => {
    if (viewers.length === 0) return null;

    return (
        <output
            data-testid="list-viewers"
            className="mb-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-muted-foreground"
        >
            <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {describeViewers(viewers)}
        </output>
    );
};
