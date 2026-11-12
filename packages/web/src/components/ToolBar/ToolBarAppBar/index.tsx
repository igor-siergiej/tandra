import { ArrowLeft, BookOpen, Calendar, Menu, ShoppingCart, Users } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { ToolBarButton } from '../ToolBarButton';

interface ToolBarAppBarProps {
    isItemsPage: boolean;
    isListsPage: boolean;
    isRecipesPage?: boolean;
    isRecipeDetailPage?: boolean;
    isCalendarPage?: boolean;
    isFriendsPage?: boolean;
    onGoBack?: () => void;
    onMenuClick: () => void;
    itemDrawer?: ReactNode;
    listDrawer?: ReactNode;
    recipeDrawer?: ReactNode;
    ingredientDrawer?: ReactNode;
    todoDrawer?: ReactNode;
    friendDrawer?: ReactNode;
    actionsFab?: ReactNode;
}

export const ToolBarAppBar = forwardRef<HTMLDivElement, ToolBarAppBarProps>(
    (
        {
            isItemsPage,
            isListsPage,
            isRecipesPage,
            isRecipeDetailPage,
            isCalendarPage,
            isFriendsPage,
            onGoBack,
            onMenuClick,
            itemDrawer,
            listDrawer,
            recipeDrawer,
            ingredientDrawer,
            todoDrawer,
            friendDrawer,
            actionsFab,
        },
        ref
    ) => {
        const navigate = useNavigate();

        const handleGoBack = () => {
            if (onGoBack) {
                onGoBack();
            } else {
                navigate('/');
            }
        };

        return (
            <div ref={ref} className="flex w-full items-center justify-between py-2.5 px-3">
                {/* Primary nav — each section's own slot swaps for back on its own drill-in page */}
                {isItemsPage ? (
                    <ToolBarButton icon={ArrowLeft} title="Go back" onClick={handleGoBack} />
                ) : (
                    <ToolBarButton
                        icon={ShoppingCart}
                        title="Shopping lists"
                        onClick={() => navigate('/')}
                        active={isListsPage}
                    />
                )}
                {isRecipeDetailPage ? (
                    <ToolBarButton icon={ArrowLeft} title="Go back" onClick={handleGoBack} />
                ) : (
                    <ToolBarButton
                        icon={BookOpen}
                        title="Recipes"
                        onClick={() => navigate('/recipes')}
                        active={isRecipesPage}
                    />
                )}
                <ToolBarButton
                    icon={Users}
                    title="Friends"
                    onClick={() => navigate('/friends')}
                    active={isFriendsPage}
                />

                {/* Context-aware add */}
                {isItemsPage && itemDrawer}
                {isListsPage && listDrawer}
                {isRecipesPage && recipeDrawer}
                {isRecipeDetailPage && ingredientDrawer}
                {isCalendarPage && todoDrawer}
                {isFriendsPage && friendDrawer}

                {actionsFab}

                {/* Calendar nav + menu — always present, page actions live in ActionsFab, not here */}
                <ToolBarButton
                    icon={Calendar}
                    title="Calendar"
                    onClick={() => navigate('/calendar')}
                    active={isCalendarPage}
                />
                <ToolBarButton icon={Menu} title="Menu" onClick={onMenuClick} />
            </div>
        );
    }
);

ToolBarAppBar.displayName = 'ToolBarAppBar';
