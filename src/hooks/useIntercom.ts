import { useState, useEffect } from 'react';

export const useIntercom = (_token: string | null) => {
  // Completely disable Intercom to avoid "App ID not set" error
};

export const useIsIntercomAvailable = () => {
  const [is_ready, setIsReady] = useState(false);

  useEffect(() => {
    // Intercom is disabled, so it's never available
    setIsReady(false);
  }, []);

  return is_ready;
};

export default useIntercom;
