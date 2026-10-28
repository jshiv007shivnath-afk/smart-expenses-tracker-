import React from 'react';
import { motion } from 'motion/react';

export const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-shimmer rounded-xl ${className}`} />
);

export const SkeletonCircle: React.FC<{ size?: string; className?: string }> = ({ size = 'w-10 h-10', className = '' }) => (
  <div className={`skeleton-shimmer rounded-full shrink-0 ${size} ${className}`} />
);

/**
 * HomeScreen skeleton loader mimicking exact layout:
 * - Top header (User avatar, status badge, greeting, notification bell circle)
 * - Live AI Marquee Ticker ribbon pill
 * - Hero Balance Card (Total balance label, large balance amount, currency pill, card dots & Mastercard circles)
 * - Monthly Budget Card with progress bar & spent/limit labels
 * - Daily Spending Card with progress bar & spent/left labels
 * - Grouped Action Buttons (Topup, Send, Withdraw, Budget)
 * - Recent Transactions header & item cards
 */
export const HomeScreenSkeleton: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex-1 w-full h-full min-h-0 flex flex-col overflow-y-auto hide-scrollbar bg-[#F2F2F7] dark:bg-black select-none pb-36"
    >
      {/* Top Header */}
      <div className="pt-14 px-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <SkeletonCircle size="w-12 h-12" />
          <div className="flex flex-col gap-1.5">
            <SkeletonBox className="w-24 h-4 rounded-md" />
            <SkeletonBox className="w-16 h-3 rounded-md" />
            <SkeletonBox className="w-28 h-5 rounded-md" />
          </div>
        </div>
        <SkeletonCircle size="w-12 h-12" className="border border-zinc-200/80 dark:border-zinc-800/80" />
      </div>

      {/* Marquee Ticker Ribbon */}
      <div className="mx-6 mt-4 h-9 rounded-full bg-white/70 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-800/60 px-3 flex items-center gap-2">
        <SkeletonBox className="w-16 h-5 rounded-full shrink-0" />
        <SkeletonBox className="w-48 h-3.5 rounded-md flex-1" />
      </div>

      {/* Hero Balance Card */}
      <div className="mx-6 mt-4 rounded-[32px] p-6 bg-white dark:bg-[#1C1C1E] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm min-h-[220px] flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SkeletonCircle size="w-2.5 h-2.5" />
              <SkeletonBox className="w-24 h-3 rounded-md" />
            </div>
            <SkeletonBox className="w-52 h-11 rounded-2xl" />
          </div>
          <SkeletonBox className="w-16 h-8 rounded-full" />
        </div>

        <div className="mt-6 flex justify-between items-end">
          <SkeletonBox className="w-36 h-4 rounded-md" />
          <div className="flex -space-x-2">
            <SkeletonCircle size="w-8 h-8" />
            <SkeletonCircle size="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Monthly Budget Card */}
      <div className="mx-6 mt-6 rounded-[24px] p-5 bg-white dark:bg-[#1C1C1E] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <SkeletonBox className="w-32 h-4 rounded-md" />
          <SkeletonBox className="w-14 h-5 rounded-full" />
        </div>
        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-full overflow-hidden">
          <SkeletonBox className="w-[60%] h-full rounded-full" />
        </div>
        <div className="flex justify-between items-center pt-0.5">
          <SkeletonBox className="w-28 h-3 rounded-md" />
          <SkeletonBox className="w-24 h-3 rounded-md" />
        </div>
      </div>

      {/* Daily Spending Card */}
      <div className="mx-6 mt-4 rounded-[24px] p-5 bg-white dark:bg-[#1C1C1E] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <SkeletonBox className="w-28 h-4 rounded-md" />
          <SkeletonBox className="w-14 h-5 rounded-full" />
        </div>
        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-full overflow-hidden">
          <SkeletonBox className="w-[45%] h-full rounded-full" />
        </div>
        <div className="flex justify-between items-center pt-0.5">
          <SkeletonBox className="w-24 h-3 rounded-md" />
          <SkeletonBox className="w-24 h-3 rounded-md" />
        </div>
      </div>

      {/* Grouped Action Buttons */}
      <div className="mx-6 mt-6 p-3.5 rounded-[26px] bg-white/90 dark:bg-[#1C1C1E]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex justify-around items-center">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <SkeletonCircle size="w-11 h-11" />
            <SkeletonBox className="w-10 h-2.5 rounded-md" />
          </div>
        ))}
      </div>

      {/* Section Title: Today's Expenses / Recent Transactions */}
      <div className="px-6 mt-8">
        <div className="flex justify-between items-center mb-4">
          <SkeletonBox className="w-36 h-5 rounded-md" />
          <SkeletonBox className="w-16 h-4 rounded-md" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-zinc-200/60 dark:border-zinc-800/60 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <SkeletonCircle size="w-11 h-11" />
                <div className="space-y-1.5">
                  <SkeletonBox className="w-28 h-4 rounded-md" />
                  <SkeletonBox className="w-20 h-3 rounded-md" />
                </div>
              </div>
              <div className="space-y-1.5 flex flex-col items-end">
                <SkeletonBox className="w-16 h-4 rounded-md" />
                <SkeletonBox className="w-12 h-2.5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Analytics Screen Skeleton matching Goals Detail & Spending Trends:
 * - Top navigation bar (Back button, Goals Detail title, More options button)
 * - Header Overview (Icon badge, trend percentage pill, 6 Months Savings title)
 * - Main Goal & Trend Card (Saved vs Target, progress bar, 20 days to go, line chart canvas)
 * - Expense Categories Donut Card
 * - Monthly Breakdown cards
 */
export const AnalyticsSkeleton: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex-1 w-full h-full min-h-0 flex flex-col overflow-y-auto hide-scrollbar bg-[#F2F2F7] dark:bg-black select-none pb-36"
    >
      {/* Top Header */}
      <div className="pt-14 px-6 flex justify-between items-center mb-6">
        <SkeletonCircle size="w-10 h-10" />
        <SkeletonBox className="w-28 h-5 rounded-md" />
        <SkeletonCircle size="w-10 h-10" />
      </div>

      {/* Header Overview */}
      <div className="px-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <SkeletonBox className="w-14 h-14 rounded-2xl" />
          <div className="flex flex-col items-end gap-1.5">
            <SkeletonBox className="w-24 h-7 rounded-full" />
            <SkeletonBox className="w-32 h-3 rounded-md" />
          </div>
        </div>

        <SkeletonBox className="w-52 h-8 rounded-xl mb-2" />
        <SkeletonBox className="w-40 h-4 rounded-md" />
      </div>

      {/* Main Goal & Monthly Spending Trend Card */}
      <div className="mx-6 bg-white dark:bg-[#1C1C1E] rounded-[28px] p-6 shadow-sm mb-6 space-y-4 border border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex justify-between items-end mb-1">
          <SkeletonBox className="w-28 h-7 rounded-lg" />
          <SkeletonBox className="w-20 h-4 rounded-md" />
        </div>
        
        <div className="h-2 w-full bg-zinc-100 dark:bg-black rounded-full overflow-hidden mb-3">
          <SkeletonBox className="w-[30%] h-full rounded-full" />
        </div>
        
        <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <SkeletonBox className="w-24 h-3.5 rounded-md" />
          <SkeletonBox className="w-10 h-3.5 rounded-md" />
        </div>

        <div className="space-y-1 pt-1">
          <SkeletonBox className="w-44 h-4 rounded-md" />
          <SkeletonBox className="w-36 h-3 rounded-md" />
        </div>

        {/* Chart Skeleton Canvas */}
        <div className="h-[200px] w-full rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/60 p-4 flex flex-col justify-end gap-2 border border-zinc-100 dark:border-zinc-800/40">
          <div className="flex items-end justify-between h-36 px-2 gap-3">
            {[45, 75, 55, 90, 65, 80].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  style={{ height: `${h}%` }} 
                  className="w-full skeleton-shimmer rounded-t-lg" 
                />
                <SkeletonBox className="w-6 h-2 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expense Categories Donut Card */}
      <div className="mx-6 mb-6 bg-white dark:bg-[#1C1C1E] rounded-[24px] p-6 shadow-sm border border-zinc-200/80 dark:border-zinc-800/80">
        <SkeletonBox className="w-36 h-4 rounded-md mb-1" />
        <SkeletonBox className="w-44 h-3 rounded-md mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="w-[180px] h-[180px] rounded-full border-[18px] border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-center relative">
            <div className="flex flex-col items-center gap-1">
              <SkeletonBox className="w-10 h-2.5 rounded-sm" />
              <SkeletonBox className="w-14 h-4 rounded-md" />
            </div>
          </div>
          <div className="space-y-3 flex-1 w-full sm:w-auto">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SkeletonCircle size="w-3 h-3" />
                  <SkeletonBox className="w-20 h-3 rounded-md" />
                </div>
                <SkeletonBox className="w-12 h-3 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown items */}
      <div className="px-6 space-y-3">
        <SkeletonBox className="w-36 h-4 rounded-md mb-2" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-zinc-200/70 dark:border-zinc-800/70 shadow-xs">
            <div className="flex items-center gap-3">
              <SkeletonBox className="w-12 h-12 rounded-xl" />
              <div className="space-y-1.5">
                <SkeletonBox className="w-24 h-4 rounded-md" />
                <SkeletonBox className="w-32 h-3 rounded-md" />
              </div>
            </div>
            <SkeletonBox className="w-18 h-4 rounded-md" />
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/**
 * History Screen Skeleton
 */
export const HistorySkeleton: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col px-5 pt-4 pb-24 overflow-hidden select-none">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBox className="w-36 h-6" />
        <SkeletonCircle size="w-10 h-10" />
      </div>

      {/* Search & Filter pills */}
      <SkeletonBox className="w-full h-12 rounded-2xl mb-4" />
      <div className="flex gap-2 mb-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} className="w-20 h-8 rounded-full shrink-0" />
        ))}
      </div>

      {/* Grouped list items */}
      <div className="space-y-3 flex-1">
        <SkeletonBox className="w-24 h-3 mb-2" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="w-10 h-10" />
              <div className="space-y-1.5">
                <SkeletonBox className="w-28 h-4" />
                <SkeletonBox className="w-16 h-3" />
              </div>
            </div>
            <SkeletonBox className="w-20 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Universal Screen Skeleton for other sub-screens (Profile, Settings, Detail, etc.)
 */
export const GenericScreenSkeleton: React.FC<{ title?: string }> = () => {
  return (
    <div className="w-full h-full flex flex-col px-5 pt-4 pb-24 overflow-hidden select-none">
      {/* Top bar with back button */}
      <div className="flex items-center gap-3 mb-6">
        <SkeletonCircle size="w-10 h-10" />
        <SkeletonBox className="w-36 h-6" />
      </div>

      {/* Card 1 */}
      <div className="w-full rounded-3xl p-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 mb-4 space-y-4">
        <div className="flex items-center gap-3">
          <SkeletonCircle size="w-14 h-14" />
          <div className="space-y-2 flex-1">
            <SkeletonBox className="w-32 h-5" />
            <SkeletonBox className="w-48 h-3.5" />
          </div>
        </div>
      </div>

      {/* List items */}
      <div className="w-full rounded-3xl p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <SkeletonCircle size="w-8 h-8" />
              <SkeletonBox className="w-36 h-4" />
            </div>
            <SkeletonBox className="w-6 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Router to return the appropriate skeleton for the current screen
 */
export const ScreenSkeleton: React.FC<{ screen: string }> = ({ screen }) => {
  switch (screen) {
    case 'home':
      return <HomeScreenSkeleton />;
    case 'analytics':
      return <AnalyticsSkeleton />;
    case 'history':
      return <HistorySkeleton />;
    default:
      return <GenericScreenSkeleton />;
  }
};
