import { useState } from 'react';

interface ConfirmationConfig {
    title: string;
    description: string;
    actionLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
}

export const useConfirmation = () => {
    const [config, setConfig] = useState<ConfirmationConfig | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const confirm = (
        options: Omit<ConfirmationConfig, 'onConfirm'> & {
            onConfirm: () => void | Promise<void>;
        }
    ) => {
        setConfig(options);
    };

    const handleConfirm = async () => {
        if (config?.onConfirm) {
            setIsLoading(true);

            try {
                const result = config.onConfirm();

                if (result instanceof Promise) {
                    await result;
                }
            } finally {
                setIsLoading(false);
                setConfig(null);
            }
        }
    };

    const handleCancel = () => {
        setConfig(null);
    };

    return {
        confirm,
        isOpen: !!config,
        config,
        handleConfirm,
        handleCancel,
        isLoading,
    };
};
