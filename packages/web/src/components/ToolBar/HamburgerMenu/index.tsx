import { Bell, Download, Loader2, LogOut, Moon, RefreshCw, Settings, Sparkles, Sun, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { useTheme } from '../../../contexts/ThemeContext';
import { useGuest } from '../../../guest/GuestContext';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { usePWA } from '../../../hooks/usePWA';
import { track } from '../../../utils/analytics';

export interface HamburgerMenuProps {
    onClose: () => void;
    onLogout: () => void;
}

interface MenuItemProps {
    children: ReactNode;
    delay?: number;
}

const MenuItem = ({ children, delay = 0.05 }: MenuItemProps) => (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.2 }}>
        {children}
    </motion.div>
);

const OUTLINE_BTN =
    'w-full justify-center h-9 text-sm font-medium transition-all duration-200 hover:bg-slate-50 active:scale-95';

interface SimpleButtonItem {
    show: boolean;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    delay?: number;
}

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"
        >
            <div className="flex items-center gap-3">
                {isDark ? <Moon className="h-4 w-4 text-slate-600" /> : <Sun className="h-4 w-4 text-slate-600" />}
                <span className="text-sm font-medium">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <Switch checked={isDark} onCheckedChange={toggleTheme} />
        </button>
    );
};

const NotificationToggle = () => {
    const { isSupported, isSubscribed, isBusy, subscribe, unsubscribe } = usePushNotifications();

    if (!isSupported) return null;

    const handleToggle = () => {
        if (isBusy) return;
        void (isSubscribed ? unsubscribe() : subscribe());
    };

    return (
        <button
            type="button"
            onClick={handleToggle}
            disabled={isBusy}
            className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 disabled:opacity-50"
        >
            <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">Notifications</span>
            </div>
            <Switch checked={isSubscribed} onCheckedChange={handleToggle} disabled={isBusy} />
        </button>
    );
};

interface UpdateButtonProps {
    hasUpdate: boolean;
    isCheckingForUpdate: boolean;
    onUpdate: () => void;
    onCheck: () => void;
}

const UpdateButton = ({ hasUpdate, isCheckingForUpdate, onUpdate, onCheck }: UpdateButtonProps) => {
    if (hasUpdate) {
        return (
            <Button variant="outline" onClick={onUpdate} className={OUTLINE_BTN}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Update available
            </Button>
        );
    }

    return (
        <Button variant="outline" onClick={onCheck} disabled={isCheckingForUpdate} className={OUTLINE_BTN}>
            {isCheckingForUpdate ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isCheckingForUpdate ? 'Checking...' : 'Check for updates'}
        </Button>
    );
};

export const HamburgerMenu = ({ onClose, onLogout }: HamburgerMenuProps) => {
    const { canInstall, isInstalled, hasUpdate, installApp, updateApp, checkForUpdate, isCheckingForUpdate } = usePWA();
    const navigate = useNavigate();
    const { isGuest } = useGuest();

    const handleInstall = async () => {
        const success = await installApp();

        if (success) onClose();
    };

    const handleUpdate = async () => {
        onClose();
        await updateApp();
    };

    const conditionalButtons: SimpleButtonItem[] = [
        {
            show: canInstall && !isInstalled,
            label: 'Install app',
            icon: <Download className="h-4 w-4 mr-2" />,
            onClick: handleInstall,
        },
    ];

    return (
        <div className="flex flex-col gap-2.5">
            {conditionalButtons.flatMap((item) =>
                item.show
                    ? [
                          <MenuItem key={item.label} delay={item.delay}>
                              <Button variant="outline" onClick={item.onClick} className={OUTLINE_BTN}>
                                  {item.icon}
                                  {item.label}
                              </Button>
                          </MenuItem>,
                      ]
                    : []
            )}

            <MenuItem delay={0.05}>
                <ThemeToggle />
            </MenuItem>

            {/* Push subscriptions are tied to an account. */}
            {!isGuest && (
                <MenuItem delay={0.1}>
                    <NotificationToggle />
                </MenuItem>
            )}

            <MenuItem delay={0.1}>
                <UpdateButton
                    hasUpdate={hasUpdate}
                    isCheckingForUpdate={isCheckingForUpdate}
                    onUpdate={handleUpdate}
                    onCheck={() => void checkForUpdate()}
                />
            </MenuItem>

            <MenuItem delay={0.12}>
                <Button
                    variant="outline"
                    onClick={() => {
                        onClose();
                        navigate('/settings');
                    }}
                    className={OUTLINE_BTN}
                >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                </Button>
            </MenuItem>

            {isGuest ? (
                <>
                    <MenuItem delay={0.14}>
                        <Button
                            variant="outline"
                            onClick={() => {
                                track('signup_prompt_action', { prompt: 'menu', action: 'register' });
                                onClose();
                                navigate('/register');
                            }}
                            className={OUTLINE_BTN}
                            data-testid="hamburger-sign-up"
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Sign up to save your lists
                        </Button>
                    </MenuItem>
                    <MenuItem delay={0.15}>
                        <Button
                            variant="destructive"
                            onClick={onLogout}
                            className="w-full justify-center h-9 text-sm font-medium transition-all duration-200 hover:bg-red-600 active:scale-95"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Exit guest mode
                        </Button>
                    </MenuItem>
                </>
            ) : (
                <MenuItem delay={0.15}>
                    <Button
                        variant="destructive"
                        onClick={onLogout}
                        className="w-full justify-center h-9 text-sm font-medium transition-all duration-200 hover:bg-red-600 active:scale-95"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Log out
                    </Button>
                </MenuItem>
            )}
        </div>
    );
};
