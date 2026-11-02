import { useEffect, useRef } from 'react';

import { useFriends } from '../../hooks/useFriends';
import { Switch } from '../ui/switch';

interface FriendPickerProps {
    value: string[];
    onChange: (ids: string[]) => void;
    seedAllByDefault?: boolean;
}

export const FriendPicker = ({ value, onChange, seedAllByDefault }: FriendPickerProps) => {
    const { friends, isLoading } = useFriends();
    const hasSeeded = useRef(false);

    useEffect(() => {
        if (hasSeeded.current || !seedAllByDefault || friends.length === 0 || value.length > 0) {
            return;
        }
        hasSeeded.current = true;
        onChange(friends.map((f) => f.id));
        // hasSeeded ref guards against re-seeding regardless of dependency changes.
    }, [friends, seedAllByDefault, value.length, onChange]);

    if (isLoading) {
        return <p className="text-sm text-muted-foreground">Loading friends…</p>;
    }

    if (friends.length === 0) {
        return <p className="text-sm text-muted-foreground">No friends yet — add one from the Friends tab to share.</p>;
    }

    const toggle = (id: string, on: boolean) => {
        onChange(on ? [...value, id] : value.filter((v) => v !== id));
    };

    return (
        <div className="rounded-lg border border-border divide-y divide-border">
            {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold">
                        {f.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{f.username}</span>
                    <Switch
                        className="ml-auto"
                        checked={value.includes(f.id)}
                        onCheckedChange={(checked: boolean) => toggle(f.id, checked)}
                        // Swallow pointer-down so tapping the switch does not steal focus from a
                        // sibling text input — keyboard stays open on mobile when toggling share
                        // targets in AddListDrawer / AddTodoDrawer / AddRecipePage. Keyboard tab
                        // focus and Space/Enter still work because pointer events don't fire for
                        // those paths.
                        onPointerDown={(e) => e.preventDefault()}
                    />
                </div>
            ))}
        </div>
    );
};
