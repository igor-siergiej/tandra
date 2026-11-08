import { useEffect, useRef, useState } from 'react';

export const useToolBarState = () => {
    const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
    const [isAddItemDrawerOpen, setIsAddItemDrawerOpen] = useState(false);
    const [isAddListDrawerOpen, setIsAddListDrawerOpen] = useState(false);
    const menuCardRef = useRef<HTMLDivElement>(null);

    const [menuActive, setMenuActive] = useState<number | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        // SAFETY: mousedown/touchstart targets inside the document are Nodes.
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (menuCardRef.current && !menuCardRef.current.contains(event.target as Node) && isMenuOpen) {
                setIsMenuOpen(false);
                setMenuActive(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMenuOpen]);

    return {
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
    };
};
