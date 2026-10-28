import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  disabled = false,
  scrollRef,
}) => {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollRef || internalRef;
  
  const startYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const threshold = 65; // Pull threshold to trigger refresh in px
  const maxPull = 100; // Maximum visual pull distance

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    // Only allow pull to refresh when scrolled to the very top
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    // Verify container is still at top
    if (container.scrollTop > 0) {
      isPullingRef.current = false;
      setPullY(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Apply non-linear resistance for smooth elastic pull feel
      const resistance = 0.45;
      const pullAmount = Math.min(diff * resistance, maxPull);
      
      // Prevent browser default bounce pull
      if (e.cancelable) {
        e.preventDefault();
      }

      setPullY(pullAmount);

      // Light tactile vibration feedback when crossing threshold
      if (pullAmount >= threshold && pullY < threshold) {
        if (navigator.vibrate) {
          navigator.vibrate(12);
        }
      }
    } else {
      setPullY(0);
    }
  }, [disabled, isRefreshing, pullY]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullY >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullY(55); // Hold at indicator height while syncing

      try {
        await onRefresh();
        setIsSuccess(true);
        if (navigator.vibrate) {
          navigator.vibrate([20, 40, 20]);
        }
        setTimeout(() => {
          setIsSuccess(false);
          setIsRefreshing(false);
          setPullY(0);
        }, 800);
      } catch (err) {
        console.error('Pull to refresh failed:', err);
        setIsRefreshing(false);
        setPullY(0);
      }
    } else {
      // Elastic spring back to top
      setPullY(0);
    }
  }, [pullY, isRefreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Rotate angle based on pull distance
  const rotateAngle = Math.min((pullY / threshold) * 180, 180);
  const isThresholdReached = pullY >= threshold;

  return (
    <div
      ref={containerRef}
      data-lenis-prevent
      className={`relative overflow-y-auto ${className}`}
      style={{
        overscrollBehaviorY: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Pull-to-refresh Indicator Header */}
      <div
        className="w-full flex items-center justify-center pointer-events-none transition-all duration-200"
        style={{
          height: `${pullY}px`,
          opacity: pullY > 5 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-md backdrop-blur-md text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          {isSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-bounce" />
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Synced with Firestore!</span>
            </>
          ) : isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 text-[#34C759] dark:text-[#C5F531] animate-spin" />
              <span>Syncing data with cloud...</span>
            </>
          ) : (
            <>
              <RefreshCw
                className="w-4 h-4 text-zinc-500 transition-transform duration-100"
                style={{ transform: `rotate(${rotateAngle}deg)` }}
              />
              <span className="text-zinc-600 dark:text-zinc-400">
                {isThresholdReached ? 'Release to sync' : 'Pull to sync Firestore'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div
        style={{
          transform: `translate3d(0, 0px, 0)`,
          transition: isPullingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {children}
      </div>
    </div>
  );
};
