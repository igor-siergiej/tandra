import { createContext, type ReactNode, useCallback, useContext, useRef } from 'react';

type RefreshFn = () => Promise<void>;

interface PullToRefreshContextType {
    registerRefresh: (fn: RefreshFn) => () => void;
    executeRefresh: () => Promise<void>;
}

const PullToRefreshContext = createContext<PullToRefreshContextType>({
    registerRefresh: () => () => {},
    executeRefresh: async () => {},
});

export const usePullToRefreshContext = () => useContext(PullToRefreshContext);

interface PullToRefreshProviderProps {
    children: ReactNode;
}

export const PullToRefreshProvider = ({ children }: PullToRefreshProviderProps) => {
    const refreshFnRef = useRef<RefreshFn | null>(null);
    const isExecutingRef = useRef(false);

    const registerRefresh = useCallback((fn: RefreshFn) => {
        refreshFnRef.current = fn;

        return () => {
            refreshFnRef.current = null;
        };
    }, []);

    const executeRefresh = useCallback(async () => {
        if (isExecutingRef.current) return;
        isExecutingRef.current = true;

        try {
            await refreshFnRef.current?.();
        } finally {
            isExecutingRef.current = false;
        }
    }, []);

    return (
        <PullToRefreshContext.Provider value={{ registerRefresh, executeRefresh }}>
            {children}
        </PullToRefreshContext.Provider>
    );
};
