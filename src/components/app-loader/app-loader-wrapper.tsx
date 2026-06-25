import React, { useState } from 'react';
import AppLoader from './app-loader';
import './app-loader-wrapper.scss';

interface AppLoaderWrapperProps {
    children: React.ReactNode;
    duration?: number; // Duration in milliseconds, default 5000ms (5 seconds)
    enabled?: boolean; // Whether to show the loader, default true
}

const AppLoaderWrapper: React.FC<AppLoaderWrapperProps> = ({ children, duration = 5000, enabled = true }) => {
    const [isLoading, setIsLoading] = useState(enabled);
    const [isLoaderVisible, setIsLoaderVisible] = useState(enabled);

    const handleLoadingComplete = () => {
        setIsLoading(false);
        // Wait for fade out animation before hiding loader
        setTimeout(() => {
            setIsLoaderVisible(false);
        }, 300);
    };

    return (
        <>
            {/* Load children in background while loader is showing */}
            <div className={isLoading ? 'app-content-background' : 'app-content-visible'}>{children}</div>
            {/* Show loader on top while loading */}
            {isLoaderVisible && <AppLoader onLoadingComplete={handleLoadingComplete} duration={duration} />}
        </>
    );
};

export default AppLoaderWrapper;
