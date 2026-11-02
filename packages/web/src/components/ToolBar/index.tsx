'use client';

import type { Item } from '@tandra/types';
import { ListType } from '@tandra/types';
import { useQueryClient } from '@tanstack/react-query';
import {
    CheckCheck,
    ChefHat,
    Compass,
    Mic,
    Plus,
    Recycle,
    ShoppingCart,
    Tag,
    Trash2,
    Users,
    UtensilsCrossed,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMeasure from 'react-use-measure';

import type { SpokenItem } from '../../api';
import { useAuth, useUser } from '../../auth';
import { Card } from '../../components/ui/card';
import { useGuest } from '../../guest/GuestContext';
import { useManageUsers } from '../../hooks/useManageUsers';
import { useToolBarState } from '../../hooks/useToolBarState';
import { clearUserData } from '../../offline/clearUserData';
import { getSpeechRecognition } from '../../utils/speechRecognition';
import { ManageLabelsDrawer } from '../ManageLabelsDrawer';
import { ManageUsersDrawer } from '../ManageUsersDrawer';
import { RippleButton } from '../ui/ripple';
import { type ActionItem, ActionsFab } from './ActionsFab';
import { AddFriendDrawer } from './AddFriendDrawer';
import { AddFromRecipeDrawer } from './AddFromRecipeDrawer';
import { AddIngredientDrawer } from './AddIngredientDrawer';
import { AddItemDrawer } from './AddItemDrawer';
import { AddListDrawer } from './AddListDrawer';
import { AddTodoDrawer } from './AddTodoDrawer';
import { HamburgerMenu } from './HamburgerMenu';
import { ToolBarAppBar } from './ToolBarAppBar';
import { VoiceAddDrawer } from './VoiceAddDrawer';

interface ToolBarProps {
    onAddList?: (name: string, listType: ListType, users: string[]) => Promise<void>;
    onAddItem?: (name: string, quantity?: number, unit?: string) => Promise<void>;
    onAddItems?: (items: Array<SpokenItem>) => Promise<void>;
    onAddIngredient?: (name: string, quantity?: number, unit?: string) => Promise<void>;
    onAddTodo?: (body: import('../../api').CreateTodoBody) => Promise<void>;
    labels?: import('@tandra/types').Label[];
    prefillTodoDate?: Date;
    handleGoBack?: () => void;
    onManageRecipeUsers?: () => void;
    handleClearSelected?: () => void;
    handleRemoveAll?: () => void;
    onToggleSelectMode?: () => void;
    placeholder?: string;
    currentListType?: ListType;
    currentList?: {
        /** The list reference used for API calls: its id (legacy links may carry the title). */
        title: string;
        /** The list's real title, for display. */
        displayTitle?: string;
        users: Array<{ id: string; username: string }>;
        ownerId?: string;
    };
    listItems?: Item[];
    refetchList?: () => void;
    disableClearSelected?: boolean;
    disableClearAll?: boolean;
}

// One bar for every page: each page's actions, drawers and menu state live here; a Discover entry adds one more row.
// fallow-ignore-next-line complexity
const ToolBar = ({
    onAddList,
    onAddItem,
    onAddItems,
    onAddIngredient,
    handleGoBack,
    onManageRecipeUsers,
    handleClearSelected,
    handleRemoveAll,
    onToggleSelectMode,
    placeholder = 'Enter item name...',
    currentListType,
    currentList,
    listItems,
    refetchList,
    disableClearSelected = false,
    disableClearAll = false,
    onAddTodo,
    labels,
    prefillTodoDate,
}: ToolBarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const queryClient = useQueryClient();
    const { user } = useUser();
    const userId = user?.id;
    const { isGuest, exitGuestMode } = useGuest();

    const {
        isManageUsersOpen,
        setIsManageUsersOpen,
        isAddItemDrawerOpen,
        setIsAddItemDrawerOpen,
        isAddListDrawerOpen,
        setIsAddListDrawerOpen,
        menuCardRef,
        menuActive,
        setMenuActive,
        isMenuOpen,
        setIsMenuOpen,
    } = useToolBarState();

    const [isAddIngredientDrawerOpen, setIsAddIngredientDrawerOpen] = useState(false);
    const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState(false);
    const [isAddFromRecipeDrawerOpen, setIsAddFromRecipeDrawerOpen] = useState(false);
    const [isAddTodoDrawerOpen, setIsAddTodoDrawerOpen] = useState(false);
    const [isManageLabelsOpen, setIsManageLabelsOpen] = useState(false);
    const [isAddFriendDrawerOpen, setIsAddFriendDrawerOpen] = useState(false);

    const isItemsPage = location.pathname.includes('/list/');
    const isListsPage = location.pathname === '/';
    const isRecipesPage = location.pathname === '/recipes';
    const isRecipeDetailPage = location.pathname.includes('/recipes/');
    const isCalendarPage = location.pathname === '/calendar';
    const isFriendsPage = location.pathname === '/friends';

    const isOwner = !!(currentList && currentList.ownerId === userId);

    const { addUserMutation: addListUserMutation, removeUserMutation: removeListUserMutation } = useManageUsers({
        listTitle: currentList?.title ?? '',
    });

    const actionItems: ActionItem[] = [
        {
            show: isItemsPage && !!currentList && !!listItems && currentListType === ListType.SHOPPING,
            label: 'Add from Recipe',
            icon: ChefHat,
            onClick: () => setIsAddFromRecipeDrawerOpen(true),
        },
        {
            show:
                isItemsPage && !!onAddItems && currentListType === ListType.SHOPPING && getSpeechRecognition() !== null,
            label: 'Add by voice',
            icon: Mic,
            onClick: () => setIsVoiceDrawerOpen(true),
        },
        {
            show: isItemsPage && !!handleClearSelected,
            label: 'Clear Selected',
            icon: CheckCheck,
            onClick: () => handleClearSelected?.(),
            disabled: disableClearSelected,
        },
        {
            show: isItemsPage && !!handleRemoveAll,
            label: 'Remove All',
            icon: Trash2,
            onClick: () => handleRemoveAll?.(),
            disabled: disableClearAll,
            variant: 'destructive',
        },
        {
            show: isItemsPage && isOwner,
            label: 'Manage Users',
            icon: Users,
            onClick: () => setIsManageUsersOpen(true),
        },
        {
            show: isRecipeDetailPage && !!onToggleSelectMode,
            label: 'Add to Shopping List',
            icon: ShoppingCart,
            onClick: () => onToggleSelectMode?.(),
        },
        {
            show: isRecipeDetailPage && !!onManageRecipeUsers,
            label: 'Manage Sharing',
            icon: Users,
            onClick: () => onManageRecipeUsers?.(),
        },
        {
            show: isCalendarPage,
            label: 'Meal plan',
            icon: UtensilsCrossed,
            onClick: () => navigate('/meal-plan'),
        },
        {
            show: isCalendarPage,
            label: 'Manage Labels',
            icon: Tag,
            onClick: () => setIsManageLabelsOpen(true),
        },
        {
            show: isRecipesPage,
            label: 'Use Up Ingredient',
            icon: Recycle,
            onClick: () => navigate('/recipes/use-up'),
        },
        {
            show: isRecipesPage,
            label: 'Discover Recipes',
            icon: Compass,
            onClick: () => navigate('/discover'),
        },
    ];

    const [contentRef, { height: contentHeight }] = useMeasure();
    const [menuRef, { width: menuWidth }] = useMeasure();
    const [maxWidth, setMaxWidth] = useState(0);

    useEffect(() => {
        if (!menuWidth || maxWidth > 0) return;
        setMaxWidth(menuWidth);
    }, [menuWidth, maxWidth]);

    const handleLogout = async () => {
        if (isGuest) {
            exitGuestMode();
            navigate('/');
            return;
        }
        await logout();
        await clearUserData(queryClient);
        navigate('/login');
    };

    const transition = {
        type: 'spring' as const,
        bounce: 0.1,
        duration: 0.25,
    };

    return (
        <>
            <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
                <div className="mx-auto max-w-[400px]">
                    <MotionConfig transition={transition}>
                        {/* Menu Container - Layered Glass Effect */}
                        {isMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute bottom-0 left-0 right-0 pointer-events-none"
                                style={{
                                    background: 'linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.02) 100%)',
                                }}
                            />
                        )}

                        <Card
                            ref={menuCardRef}
                            className="shadow-xl py-0 !gap-0 backdrop-blur-sm border border-slate-200/50 relative z-10"
                        >
                            {/* Menu Content with Staggered Animation */}
                            <div className="overflow-hidden">
                                <AnimatePresence initial={false} mode="sync">
                                    {isMenuOpen ? (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: contentHeight || 0, opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{
                                                height: { duration: 0.3 },
                                                opacity: { duration: 0.2 },
                                            }}
                                            style={{ width: maxWidth }}
                                        >
                                            <div ref={contentRef} className="px-3 py-4">
                                                {menuActive === 1 && (
                                                    <HamburgerMenu
                                                        onClose={() => {
                                                            setIsMenuOpen(false);
                                                            setMenuActive(null);
                                                        }}
                                                        onLogout={() => {
                                                            void handleLogout();
                                                            setIsMenuOpen(false);
                                                            setMenuActive(null);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>
                            {/* Visual Separator - Divider Line */}
                            {isMenuOpen && (
                                <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                            )}

                            {/* App Bar - The persistent bottom navigation */}
                            <ToolBarAppBar
                                ref={menuRef}
                                isItemsPage={isItemsPage}
                                isListsPage={isListsPage}
                                isRecipesPage={isRecipesPage}
                                isRecipeDetailPage={isRecipeDetailPage}
                                isCalendarPage={isCalendarPage}
                                isFriendsPage={isFriendsPage}
                                onGoBack={handleGoBack}
                                actionsFab={<ActionsFab actionItems={actionItems} />}
                                onMenuClick={() => {
                                    setIsMenuOpen(!isMenuOpen);
                                    if (!isMenuOpen) {
                                        setMenuActive(1);
                                    } else {
                                        setMenuActive(null);
                                    }
                                }}
                                todoDrawer={
                                    isCalendarPage && onAddTodo ? (
                                        <AddTodoDrawer
                                            open={isAddTodoDrawerOpen}
                                            onOpenChange={setIsAddTodoDrawerOpen}
                                            onAdd={onAddTodo}
                                            labels={labels ?? []}
                                            prefillDate={prefillTodoDate}
                                        />
                                    ) : undefined
                                }
                                itemDrawer={
                                    isItemsPage && onAddItem ? (
                                        <AddItemDrawer
                                            open={isAddItemDrawerOpen}
                                            onOpenChange={setIsAddItemDrawerOpen}
                                            onAdd={onAddItem}
                                            listType={currentListType}
                                            placeholder={placeholder}
                                        />
                                    ) : undefined
                                }
                                listDrawer={
                                    isListsPage && onAddList ? (
                                        <AddListDrawer
                                            open={isAddListDrawerOpen}
                                            onOpenChange={setIsAddListDrawerOpen}
                                            onAdd={onAddList}
                                            placeholder={placeholder}
                                        />
                                    ) : undefined
                                }
                                recipeDrawer={
                                    isRecipesPage ? (
                                        <RippleButton
                                            size="icon"
                                            className="h-12 w-12 rounded-full border-2 border-primary/20 hover:border-primary/40 transition-colors"
                                            aria-label="Add recipe"
                                            onClick={() => navigate('/recipes/new')}
                                        >
                                            <Plus className="size-5" />
                                        </RippleButton>
                                    ) : undefined
                                }
                                ingredientDrawer={
                                    isRecipeDetailPage && onAddIngredient ? (
                                        <AddIngredientDrawer
                                            open={isAddIngredientDrawerOpen}
                                            onOpenChange={setIsAddIngredientDrawerOpen}
                                            onAdd={onAddIngredient}
                                        />
                                    ) : undefined
                                }
                                friendDrawer={
                                    isFriendsPage ? (
                                        <AddFriendDrawer
                                            open={isAddFriendDrawerOpen}
                                            onOpenChange={setIsAddFriendDrawerOpen}
                                        />
                                    ) : undefined
                                }
                            />
                        </Card>
                    </MotionConfig>
                </div>
            </div>

            {isItemsPage && currentList && listItems && (
                <AddFromRecipeDrawer
                    open={isAddFromRecipeDrawerOpen}
                    onOpenChange={setIsAddFromRecipeDrawerOpen}
                    listTitle={currentList.title}
                    listItems={listItems}
                    hideTrigger
                />
            )}

            {isItemsPage && onAddItems && (
                <VoiceAddDrawer open={isVoiceDrawerOpen} onOpenChange={setIsVoiceDrawerOpen} onAddMany={onAddItems} />
            )}

            {/* ManageLabelsDrawer: labels are account data, and fetching them as a guest only fails. */}
            {!isGuest && <ManageLabelsDrawer open={isManageLabelsOpen} onOpenChange={setIsManageLabelsOpen} />}

            {/* ManageUsersDrawer and Drawer backdrop */}
            {currentList && isItemsPage && (
                <ManageUsersDrawer
                    open={isManageUsersOpen}
                    onOpenChange={setIsManageUsersOpen}
                    title={currentList.displayTitle ?? currentList.title}
                    currentUsers={currentList.users}
                    ownerId={currentList.ownerId ?? ''}
                    currentUserId={userId ?? ''}
                    addUserMutation={addListUserMutation}
                    removeUserMutation={removeListUserMutation}
                    onUserAdded={() => {
                        refetchList?.();
                    }}
                    onUserRemoved={() => {
                        refetchList?.();
                    }}
                />
            )}
        </>
    );
};

export default ToolBar;
