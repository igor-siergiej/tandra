import type { ListType } from '@tandra/types';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ListPlus } from 'lucide-react';
import { useEffect } from 'react';

import ListsList from '../../components/ListsList';
import { ListsSkeleton } from '../../components/LoadingSkeleton';
import ToolBar from '../../components/ToolBar';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { usePullToRefreshContext } from '../../contexts/PullToRefreshContext';
import { useCreateList } from '../../hooks/useCreateList';
import { useListSource, useListUser } from '../../hooks/useListSource';
import { logger } from '../../utils/logger';

const ListsPage = () => {
    const user = useListUser();
    const source = useListSource();
    const { data, isLoading, isError, refetch } = useQuery({
        ...source.listsQuery(user?.id || ''),
        enabled: !!user?.id,
    });
    const { registerRefresh } = usePullToRefreshContext();
    const createList = useCreateList(user);

    useEffect(() => {
        return registerRefresh(async () => {
            await refetch();
        });
    }, [registerRefresh, refetch]);

    useEffect(() => {
        if (user?.id) {
            logger.info('Lists page loaded', { userId: user.id, username: user.username });
        }
    }, [user?.id, user?.username]);

    if (!user?.id) {
        logger.warn('Lists page accessed without user');
        return <div>User not available</div>;
    }

    const pageContent = (
        <div className="flex flex-col space-y-6">
            {data && data.length > 0 ? (
                <ListsList lists={data} refetch={refetch} currentUserId={user.id} />
            ) : (
                <Empty className="flex-none justify-start p-4">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ListPlus />
                        </EmptyMedia>
                        <EmptyTitle>No lists yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first list, or ask a friend to share one with you
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </div>
    );

    const handleAddList = async (listTitle: string, listType: ListType, selectedUsers: string[]) => {
        try {
            await createList(listTitle, listType, selectedUsers);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to create list', { listTitle, error: errorMessage });
            throw error;
        }
    };

    const errorPageContent = (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex items-center gap-3 text-destructive mb-3">
                <AlertTriangle className="h-6 w-6" />
                <span className="font-semibold">Unable to load your lists</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-sm">Please check your connection and try again.</p>
            <Button
                variant="default"
                onClick={() => {
                    void refetch();
                }}
            >
                Retry
            </Button>
        </div>
    );

    return (
        <>
            {isError && errorPageContent}
            {isLoading && <ListsSkeleton />}
            {!isLoading && !isError && pageContent}

            <ToolBar onAddList={handleAddList} placeholder="Enter list name..." />
        </>
    );
};

export default ListsPage;
