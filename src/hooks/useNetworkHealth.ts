import { useState, useEffect, useCallback, useRef } from 'react';

export function useNetworkHealth() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const checkingRef = useRef(false);

  // Active ping function to confirm real connectivity
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (checkingRef.current) return isOnline;
    checkingRef.current = true;
    setIsChecking(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setIsChecking(false);
      checkingRef.current = false;
      return false;
    }

    try {
      // Fast ping test to backend health or random query
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const ok = res.ok || res.status < 500;
      setIsOnline(ok);
      setIsChecking(false);
      checkingRef.current = false;
      return ok;
    } catch {
      // If health endpoint fails due to offline/timeout
      // Fallback check navigator.onLine
      const fallback = typeof navigator !== 'undefined' ? navigator.onLine : false;
      setIsOnline(fallback);
      setIsChecking(false);
      checkingRef.current = false;
      return fallback;
    }
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      // Quick check to confirm internet is genuinely reachable
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    checkConnectivity();

    // Periodic gentle heartbeat check every 25 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkConnectivity();
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  return {
    isOnline,
    setIsOnline,
    isChecking,
    checkConnectivity
  };
}
