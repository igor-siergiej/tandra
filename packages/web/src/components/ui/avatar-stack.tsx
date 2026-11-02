import type { User } from '@tandra/types';

import { cn } from '../../lib/utils';

const AVATAR_COLORS = [
    'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-100',
    'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100',
    'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100',
    'bg-sky-200 text-sky-800 dark:bg-sky-800 dark:text-sky-100',
    'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-100',
];

const hashString = (value: string) =>
    value.split('').reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);

const getInitials = (username: string) => username.slice(0, 2).toUpperCase();

const getColorClasses = (username: string) => AVATAR_COLORS[Math.abs(hashString(username)) % AVATAR_COLORS.length];

interface AvatarStackProps {
    users: Array<User>;
    max?: number;
    className?: string;
}

export const AvatarStack = ({ users, max = 3, className }: AvatarStackProps) => {
    if (users.length === 0) {
        return null;
    }

    const visible = users.slice(0, max);
    const overflow = users.length - visible.length;

    return (
        <div className={cn('flex items-center -space-x-2', className)}>
            {visible.map((user) => (
                <div
                    key={user.id}
                    title={user.username}
                    className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-background',
                        getColorClasses(user.username)
                    )}
                >
                    {getInitials(user.username)}
                </div>
            ))}
            {overflow > 0 && (
                <div
                    title={`+${overflow} more`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-slate-700 ring-2 ring-background dark:bg-slate-600 dark:text-slate-100"
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
};
