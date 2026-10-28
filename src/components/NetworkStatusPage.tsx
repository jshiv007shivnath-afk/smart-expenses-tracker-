import React, { useState } from 'react';
import { motion } from 'motion/react';
import { WifiOff, RefreshCw, Smartphone, Wifi, Radio, AlertCircle } from 'lucide-react';

interface NetworkStatusPageProps {
  onRetry: () => Promise<boolean> | void;
  isChecking?: boolean;
}

export const NetworkStatusPage: React.FC<NetworkStatusPageProps> = ({ onRetry, isChecking = false }) => {
  const [localChecking, setLocalChecking] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const handleRetry = async () => {
    setLocalChecking(true);
    setRetryFailed(false);
    try {
      if (onRetry) {
        const result = await onRetry();
        if (result === false) {
          setRetryFailed(true);
        }
      }
    } catch {
      setRetryFailed(true);
    } finally {
      setLocalChecking(false);
    }
  };

  const checking = isChecking || localChecking;

  return (
    <div 
      id="no-internet-screen"
      className="fixed inset-0 w-full h-[100dvh] bg-[#F4F5F8] dark:bg-zinc-950 font-sans flex flex-col justify-between items-center z-[99999] overflow-hidden select-none px-6 py-10"
    >
      {/* Top Header bar with status badge */}
      <div className="w-full max-w-sm flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-red-500 dark:text-red-400">
            Offline Mode
          </span>
        </div>
        <div className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
          <WifiOff size={14} />
          No Connection
        </div>
      </div>

      {/* Main Illustration & Message */}
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto">
        {/* Animated Radar Pulse circles */}
        <div className="relative flex items-center justify-center mb-8">
          <motion.div 
            animate={{ scale: [1, 1.4, 1.8], opacity: [0.35, 0.15, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            className="absolute w-32 h-32 rounded-full bg-red-500/20 dark:bg-red-500/10 pointer-events-none"
          />
          <motion.div 
            animate={{ scale: [1, 1.3], opacity: [0.45, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            className="absolute w-24 h-24 rounded-full bg-red-500/30 dark:bg-red-500/20 pointer-events-none"
          />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-red-500 to-rose-400 shadow-xl shadow-red-500/25 flex items-center justify-center text-white">
            <WifiOff size={38} strokeWidth={2.3} className="drop-shadow-sm" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight mb-3">
          No Internet Connection
        </h1>

        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-300 max-w-[320px] mb-6 font-normal">
          Smart Expenses ko render karne ke liye active internet connection chahiye. Kripya apna Wi-Fi ya Mobile Data ON karein.
        </p>

        {/* Failed Banner */}
        {retryFailed && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2.5 text-left"
          >
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Internet abhi bhi disconnected hai. Check karein aur dubara koshish karein.
            </p>
          </motion.div>
        )}

        {/* Action Button */}
        <button
          id="btn-retry-internet"
          type="button"
          onClick={handleRetry}
          disabled={checking}
          className="w-full h-14 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw size={18} className={`${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Checking Connection...' : 'Try Reconnecting'}</span>
        </button>

        {/* Helper Steps Card */}
        <div className="w-full mt-6 bg-white dark:bg-zinc-900/80 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 text-left shadow-sm">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Radio size={14} className="text-zinc-500" />
            Quick Troubleshooting
          </div>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300">1</span>
              <Wifi size={14} className="text-zinc-400" />
              <span>Turn Wi-Fi or Mobile Data ON in settings</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300">2</span>
              <Smartphone size={14} className="text-zinc-400" />
              <span>Toggle Airplane Mode OFF and ON</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-sm text-center pt-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Once internet is restored, the app will automatically open.
        </p>
      </div>
    </div>
  );
};
