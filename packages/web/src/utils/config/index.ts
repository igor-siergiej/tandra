import type { AppConfig, ConfigState } from './types';

const CONFIG_STORAGE_KEY = 'tandra:config';

const configState: ConfigState = {
    config: null,
    isLoading: false,
    error: null,
};

// Missing, unparsable and non-object cache entries all mean "no cached config".
// fallow-ignore-next-line complexity
const readCachedConfig = (): AppConfig | null => {
    try {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);

        if (!raw) return null;
        const cached = JSON.parse(raw);

        return cached && typeof cached === 'object' ? (cached as AppConfig) : null;
    } catch {
        return null;
    }
};

// Config rarely changes, so a stale cached copy is preferable to blocking
// launch entirely when the network fetch fails while offline.
// fallow-ignore-next-line complexity
export const loadConfig = async (): Promise<AppConfig> => {
    configState.isLoading = true;
    configState.error = null;

    try {
        const response = await fetch('/config.json');

        if (!response.ok) {
            throw new Error(`Failed to fetch config.json: ${response.status} ${response.statusText}`);
        }

        const configData = await response.json();
        configState.config = configData as AppConfig;
        configState.isLoading = false;

        try {
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configState.config));
        } catch {
            // Storage unavailable or full: the cache is only an offline fallback.
        }

        return configState.config;
    } catch (error) {
        const cached = readCachedConfig();

        if (cached) {
            configState.config = cached;
            configState.isLoading = false;

            return cached;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        configState.error = errorMessage;
        configState.isLoading = false;

        throw new Error(`Configuration failed to load: ${errorMessage}`);
    }
};

export const getConfig = (): AppConfig => {
    if (!configState.config) {
        throw new Error('Configuration not loaded.');
    }

    return configState.config;
};
