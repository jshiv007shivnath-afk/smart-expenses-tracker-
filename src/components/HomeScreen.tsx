import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Bell, Plus, ArrowUpRight, ArrowDownLeft, Goal, Camera, 
  Sparkles, X
} from 'lucide-react';
import RotatingText from './ui/RotatingText';

export interface HomeScreenProps {
  user: any;
  balance: number;
  budget: number;
  setBudget: (val: number) => void;
  dailyLimit?: number;
  setDailyLimit?: (val: number) => void;
  dailySpendingNote?: string;
  setDailySpendingNote?: (val: string) => void;
  transactions: any[];
  currencySymbol?: string;
  currency?: string;
  onAction?: (action: string) => void;
  onNavigateScreen?: (screen: string) => void;
  onTransactionSelect?: (id: string) => void;
  onLogout?: () => void;
  onDeleteTransaction?: (id: string) => void;
}

const formatAmount = (num: number, symbol: string = '$'): string => {
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  balance,
  budget,
  setBudget,
  dailyLimit = 0,
  setDailyLimit,
  dailySpendingNote = '',
  setDailySpendingNote,
  transactions = [],
  currencySymbol = '$',
  currency = 'USD',
  onAction = (_action: string) => {},
  onNavigateScreen = (_screen: string) => {},
  onTransactionSelect = (_id: string) => {},
  onDeleteTransaction = (_id: string) => {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState(budget.toString());

  const { totalExpenses, totalDailyExpenses } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayDate = now.getDate();

    let monthExp = 0;
    let dailyExp = 0;

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.type === 'expense') {
        const d = new Date(t.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          monthExp += t.amount;
          if (d.getDate() === todayDate) {
            dailyExp += t.amount;
          }
        }
      }
    }

    return {
      totalExpenses: monthExp,
      totalDailyExpenses: dailyExp
    };
  }, [transactions]);

  const budgetRatio = budget > 0 ? (totalExpenses / budget) : 0;
  const dailyRatio = dailyLimit > 0 ? (totalDailyExpenses / dailyLimit) : 0;

  const formattedBalanceStr = `${currencySymbol}${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const balanceFontSizeClass = formattedBalanceStr.length > 15 
    ? 'text-2xl sm:text-3xl' 
    : formattedBalanceStr.length > 11 
    ? 'text-3xl sm:text-4xl' 
    : 'text-4xl sm:text-5xl';

  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain touch-pan-y hide-scrollbar bg-[#F2F2F7] dark:bg-black pb-36"
      ref={containerRef}
    >
      {/* Header */}
      <div className="pt-14 px-6 flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
          className="flex items-center gap-4"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="w-12 h-12 rounded-full object-cover shadow-sm" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1C1C1E] flex items-center justify-center shadow-sm">
              <User size={24} className="text-gray-400" />
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5">
              <RotatingText
                texts={['Smart Expenses', 'Predictive AI', 'Smart Track', 'Smart Expenses']}
                mainClassName="px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-md border border-emerald-500/20 overflow-hidden inline-flex items-center"
                staggerFrom="last"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-120%" }}
                staggerDuration={0.025}
                splitLevelClassName="overflow-hidden pb-0.5"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                rotationInterval={2500}
              />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Good Morning,</span>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              {user?.displayName ? `Hi, ${user.displayName.split(' ')[0]}` : 'Hi, Guest'}
            </h1>
          </div>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => onNavigateScreen('notifications')}
          className="flex items-center justify-center w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Bell size={20} className="stroke-[2]" />
        </motion.div>
      </div>

      {/* Marquee Ticker Ribbon */}
      <div className="mx-6 mt-4 overflow-hidden rounded-full bg-zinc-900/90 border border-[#C5F531]/30 py-1.5 px-3 backdrop-blur-md shadow-md flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#C5F531] text-zinc-900 text-xs font-black px-2.5 py-0.5 rounded-full shrink-0 uppercase tracking-widest animate-pulse">
          <Sparkles size={11} className="fill-zinc-900" /> LIVE AI
        </div>
        <div className="overflow-hidden relative w-full flex items-center">
          <motion.div
            className="flex whitespace-nowrap gap-8 text-xs font-bold text-zinc-200 dark:text-zinc-300"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          >
            <span>⚡ 15% Cashback active on Dining & Grocery</span>
            <span>🔥 AI Budget Guardian: Monthly spending ON TRACK</span>
            <span>💡 Quick Pay & Auto-Categorization Active</span>
          </motion.div>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
        className="mx-6 mt-4 bg-[#C5F531] rounded-[32px] p-6 relative overflow-hidden card-3d-effect min-h-[240px] flex flex-col justify-between cursor-pointer hover:shadow-2xl"
      >
        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0D2111] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0D2111]"></span>
              </span>
              <p className="text-[#0D2111]/80 text-[12px] font-extrabold uppercase tracking-widest">Total Balance</p>
            </div>
            <h2 className={`text-[#0D2111] font-bold tracking-tighter truncate ${balanceFontSizeClass}`}>{formattedBalanceStr}</h2>
          </div>
          <div className="bg-[#0D2111] px-4 py-2 rounded-full shadow-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#C5F531] animate-pulse" />
            <span className="text-[#C5F531] text-[13px] font-bold tracking-wide">{currency}</span>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex justify-between items-end">
          <p className="text-[#0D2111] text-[16px] font-bold tracking-widest opacity-80">
            •••• •••• •••• 4092
          </p>
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1C1C1E]/40 border-2 border-[#C5F531]" />
            <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1C1C1E]/20 border-2 border-[#C5F531]" />
          </div>
        </div>
      </motion.div>

      {/* Monthly Budget Progress Section */}
      <motion.div 
        className="mx-6 mt-6 liquid-glass-card rounded-[24px] p-5 relative overflow-hidden transition-all duration-300"
        whileHover={{ scale: 1.01, y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white tracking-tight">Monthly Budget</h3>
          <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${
            budgetRatio >= 0.95
              ? 'text-red-500 bg-red-100 dark:bg-red-500/10'
              : budgetRatio > 0.90
              ? 'text-rose-500 bg-rose-100 dark:bg-rose-500/10'
              : budgetRatio >= 0.80
              ? 'text-amber-500 bg-amber-100 dark:bg-amber-500/10'
              : 'text-[#34C759] bg-[#E5F7ED] dark:bg-[#34C759]/10'
          }`}>
            {budget > 0 ? `${(budgetRatio * 100).toFixed(0)}%` : 'Set Budget'}
          </span>
        </div>
        
        {budget > 0 ? (
          <>
            <div className="h-2 w-full bg-[#F2F2F7] dark:bg-black rounded-full overflow-hidden mb-2 relative">
              <motion.div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  budgetRatio >= 0.95
                    ? 'bg-red-500 budget-red-glow-100'
                    : budgetRatio > 0.90
                    ? 'bg-rose-500'
                    : budgetRatio >= 0.80
                    ? 'bg-amber-500 budget-pulse-80'
                    : 'bg-[#34C759]'
                }`} 
                style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }} 
                animate={
                  budgetRatio > 0.9
                    ? {
                        opacity: [1, 0.6, 1],
                        scaleY: [1, 1.2, 1],
                        filter: [
                          'drop-shadow(0 0 0px rgba(239, 68, 68, 0))',
                          'drop-shadow(0 0 6px rgba(239, 68, 68, 0.75))',
                          'drop-shadow(0 0 0px rgba(239, 68, 68, 0))'
                        ]
                      }
                    : {
                        opacity: 1,
                        scaleY: 1,
                        filter: 'drop-shadow(0 0 0px rgba(0, 0, 0, 0))'
                      }
                }
                transition={
                  budgetRatio > 0.9
                    ? {
                        duration: 1.4,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }
                    : { duration: 0.3 }
                }
              />
            </div>
            <div className="flex justify-between items-center text-[13px] gap-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium truncate">Spent {formatAmount(totalExpenses, currencySymbol)}</span>
              <span className="text-gray-900 dark:text-white font-bold shrink-0">Limit {formatAmount(budget, currencySymbol)}</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <button 
              onClick={() => onNavigateScreen('budget')}
              className="text-[14px] font-bold text-[#34C759] hover:underline"
            >
              Set Monthly Limit
            </button>
          </div>
        )}
      </motion.div>

      {/* Daily Spending Bar */}
      <motion.div 
        className="mx-6 mt-4 liquid-glass-card rounded-[24px] p-5 relative overflow-hidden transition-all duration-300"
        whileHover={{ scale: 1.01, y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-white tracking-tight">Daily Spending</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">Today</span>
          </div>
          <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${
            dailyRatio >= 0.95
              ? 'text-red-500 bg-red-100 dark:bg-red-500/10'
              : dailyRatio > 0.90
              ? 'text-rose-500 bg-rose-100 dark:bg-rose-500/10'
              : dailyRatio >= 0.80
              ? 'text-amber-500 bg-amber-100 dark:bg-amber-500/10'
              : 'text-[#34C759] bg-[#E5F7ED] dark:bg-[#34C759]/10'
          }`}>
            {dailyLimit > 0 ? `${(dailyRatio * 100).toFixed(0)}%` : 'Set Limit'}
          </span>
        </div>

        {dailyLimit > 0 ? (
          <>
            <div className="h-2 w-full bg-[#F2F2F7] dark:bg-black rounded-full overflow-hidden mb-2 relative">
              <motion.div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  dailyRatio >= 0.95
                    ? 'bg-red-500 budget-red-glow-100'
                    : dailyRatio > 0.90
                    ? 'bg-rose-500'
                    : dailyRatio >= 0.80
                    ? 'bg-amber-500 budget-pulse-80'
                    : 'bg-[#34C759]'
                }`} 
                style={{ width: `${Math.min(dailyRatio * 100, 100)}%` }}
                animate={
                  dailyRatio > 0.9
                    ? {
                        opacity: [1, 0.6, 1],
                        scaleY: [1, 1.2, 1],
                        filter: [
                          'drop-shadow(0 0 0px rgba(239, 68, 68, 0))',
                          'drop-shadow(0 0 6px rgba(239, 68, 68, 0.75))',
                          'drop-shadow(0 0 0px rgba(239, 68, 68, 0))'
                        ]
                      }
                    : {
                        opacity: 1,
                        scaleY: 1,
                        filter: 'drop-shadow(0 0 0px rgba(0, 0, 0, 0))'
                      }
                }
                transition={
                  dailyRatio > 0.9
                    ? {
                        duration: 1.4,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }
                    : { duration: 0.3 }
                }
              />
            </div>
            <div className="flex justify-between items-center text-[13px] gap-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium truncate">Spent {formatAmount(totalDailyExpenses, currencySymbol)}</span>
              <span className="text-gray-900 dark:text-white font-bold shrink-0">
                Left {formatAmount(Math.max(0, dailyLimit - totalDailyExpenses), currencySymbol)}
              </span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <button 
              onClick={() => onNavigateScreen('budget')}
              className="text-[14px] font-bold text-[#34C759] hover:underline"
            >
              Set Daily Limit
            </button>
          </div>
        )}
      </motion.div>

      {/* Action Buttons */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 100, damping: 20 }}
        className="mx-6 mt-6 p-3.5 rounded-[26px] bg-white/90 dark:bg-[#1C1C1E]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex justify-around items-center"
      >
        <button onClick={() => onAction('topup')} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Plus size={20} className="text-zinc-900 dark:text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Topup</span>
        </button>
        <button onClick={() => onAction('send')} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <ArrowUpRight size={20} className="text-zinc-900 dark:text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Send</span>
        </button>
        <button onClick={() => onAction('withdraw')} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <ArrowDownLeft size={20} className="text-zinc-900 dark:text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Withdraw</span>
        </button>
        <button onClick={() => onNavigateScreen('budget')} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Goal size={20} className="text-zinc-900 dark:text-white" />
          </div>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Budget</span>
        </button>
      </motion.div>

      {/* AI Scan Banner */}
      <motion.div 
        className="mt-6 px-6 cursor-pointer"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigateScreen('receipt_scanner')}
      >
        <div className="relative w-full rounded-[24px] overflow-hidden bg-[#0D2111] shadow-xl hover:shadow-2xl transition-all border border-white/10 flex items-center p-4">
          <div className="w-12 h-12 bg-[#C5F531] rounded-full flex items-center justify-center relative z-10 mr-4 shadow-lg shrink-0">
            <Camera size={24} className="text-[#0D2111]" />
          </div>
          <div className="z-10 relative flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-[#C5F531] bg-[#C5F531]/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Free Feature</span>
              <span className="text-xs font-bold text-zinc-300">3 Free Scans Daily</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight leading-snug">AI Bill & Receipt Scanner</h3>
            <p className="text-xs text-zinc-400 font-medium">Scan & auto-extract items into transactions</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HomeScreen;
