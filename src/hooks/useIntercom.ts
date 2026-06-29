import { useState, useEffect } from 'react';

export const useIntercom = (_token: string | null) => {
    // Disable Intercom to avoid "App ID not set" error
};

export const useIsIntercomAvailable = () => {
    // Intercom is disabled, so it's never available
    return false;
};

export default useIntercom;
