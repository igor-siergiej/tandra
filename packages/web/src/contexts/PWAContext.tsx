import { RefreshCw } from 'lucide-react';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_NOTIFIED_KEY = 'pwa-update-notified-at';
const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAContextType {
    deferredPrompt: BeforeInstallPromptEvent | null;
    canInstall: boolean;
    isInstalled: boolean;
    installApp: () => Promise<boolean>;
    hasUpdate: boolean;
    isUpdating: boolean;
    updateApp: () => void;
    checkForUpdate: () => Promise<void>;
    isCheckingForUpdate: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const usePWAContext = () => {
    const context = useContext(PWAContext);

    if (context === undefined) {
        throw new Error('usePWAContext must be used within a PWAProvider');
    }

    return context;
};

interface PWAProviderProps {
    children: React.ReactNode;
}

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [canInstall, setCanInstall] = useState(false);

    // Read on first render, not in an effect, so consumers never see a false `isInstalled` for a
    // frame inside an installed window.
    const [isInstalled, setIsInstalled] = useState(
        () =>
            window.matchMedia?.('(display-mode: standalone)').matches === true ||
            ('standalone' in navigator && navigator.standalone === true)
    );

    const [hasUpdate, setHasUpdate] = useState(false);
    const [shouldShowUpdateToast, setShouldShowUpdateToast] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
    const toastIdRef = useRef<string | number | null>(null);
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

    const { updateServiceWorker } = useRegisterSW({
        onRegisteredSW(_swUrl, r) {
            if (!r) return;

            registrationRef.current = r;

            const checkForUpdate = () => {
                if (!r.installing && navigator.onLine) {
                    void r.update();
                }
            };

            setInterval(checkForUpdate, 5 * 60 * 1000);

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    checkForUpdate();
                }
            });
        },
        onRegisterError() {},
        onNeedRefresh() {
            setHasUpdate(true);
            const lastNotified = localStorage.getItem(UPDATE_NOTIFIED_KEY);

            if (!lastNotified || Date.now() - Number(lastNotified) > UPDATE_SNOOZE_MS) {
                setShouldShowUpdateToast(true);
            }
        },
        onOfflineReady() {},
    });

    const checkForUpdate = useCallback(async () => {
        const r = registrationRef.current;

        if (!r || isCheckingForUpdate) return;
        setIsCheckingForUpdate(true);

        try {
            await r.update();
        } finally {
            setIsCheckingForUpdate(false);
        }
    }, [isCheckingForUpdate]);

    const updateApp = useCallback(() => {
        localStorage.removeItem(UPDATE_NOTIFIED_KEY);

        if (toastIdRef.current !== null) {
            toast.dismiss(toastIdRef.current);
            toastIdRef.current = null;
        }

        setIsUpdating(true);
        updateServiceWorker(true);
    }, [updateServiceWorker]);

    useEffect(() => {
        if (!shouldShowUpdateToast) return;

        localStorage.setItem(UPDATE_NOTIFIED_KEY, Date.now().toString());

        if (toastIdRef.current !== null) {
            toast.dismiss(toastIdRef.current);
        }

        toastIdRef.current = toast('A new version is available', {
            duration: Number.POSITIVE_INFINITY,
            icon: <RefreshCw className="h-4 w-4" />,
            action: {
                label: 'Update',
                onClick: updateApp,
            },
        });
    }, [shouldShowUpdateToast, updateApp]);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            // SAFETY: beforeinstallprompt is a Chromium event that lib.dom does not declare; the listener is registered only for that event name.
            const event = e as BeforeInstallPromptEvent;

            setDeferredPrompt(event);
            setCanInstall(true);
        };

        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            setCanInstall(false);
            setIsInstalled(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const installApp = async (): Promise<boolean> => {
        if (!deferredPrompt) return false;

        try {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;

            if (choice.outcome === 'accepted') {
                setCanInstall(false);
                setIsInstalled(true);
                setDeferredPrompt(null);

                return true;
            }
        } catch {
            // Error installing app
        }

        return false;
    };

    const value: PWAContextType = {
        deferredPrompt,
        canInstall,
        isInstalled,
        installApp,
        hasUpdate,
        isUpdating,
        updateApp,
        checkForUpdate,
        isCheckingForUpdate,
    };

    return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
};
