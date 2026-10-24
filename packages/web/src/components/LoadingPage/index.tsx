import { motion } from 'motion/react';
import type React from 'react';
import './loader.css';

interface LoadingPageProps {
    timeoutReached?: boolean;
}

const TimeoutHint: React.FC = () => (
    <div className="text-center text-sm text-orange-600 max-w-md">
        <p>Taking longer than expected...</p>
        <p>If this persists, try:</p>
        <ul className="list-disc text-left mt-2 pl-4">
            <li>Hard refresh (Ctrl+F5)</li>
            <li>Clear browser data</li>
            <li>Reinstall the app</li>
        </ul>
    </div>
);

const LoadingPage: React.FC<LoadingPageProps> = ({ timeoutReached }) => (
    <motion.div
        className="flex flex-col items-center justify-center h-screen gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
    >
        <div className="loader" />
        {timeoutReached && <TimeoutHint />}
    </motion.div>
);

export default LoadingPage;
