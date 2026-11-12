import { Users } from 'lucide-react';
import { useState } from 'react';

import ToolBar from '../../components/ToolBar';
import { Card } from '../../components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { useFriends } from '../../hooks/useFriends';
import { FriendDetail } from './FriendDetail';

const FriendsPage = () => {
    const { friends, isLoading } = useFriends();
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

    const selectedFriend = friends.find((friend) => friend.id === selectedFriendId);

    if (selectedFriend) {
        return <FriendDetail friend={selectedFriend} onBack={() => setSelectedFriendId(null)} />;
    }

    const pageContent =
        friends.length > 0 ? (
            <Card className="divide-y divide-border py-0">
                {friends.map((friend) => (
                    <button
                        key={friend.id}
                        type="button"
                        onClick={() => setSelectedFriendId(friend.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50"
                    >
                        <div className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold">
                            {friend.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{friend.username}</span>
                    </button>
                ))}
            </Card>
        ) : (
            <Empty className="flex-none justify-start p-4">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Users />
                    </EmptyMedia>
                    <EmptyTitle>No friends yet</EmptyTitle>
                    <EmptyDescription>Tap the + button below to add a friend</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );

    return (
        <>
            <div className="flex flex-col">
                <h2 className="text-lg font-semibold mb-3 text-foreground">Friends</h2>
                {!isLoading && pageContent}
            </div>

            <ToolBar />
        </>
    );
};

export default FriendsPage;
