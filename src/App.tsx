import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);
import { 
  Settings, LogOut, ArrowUpRight, ArrowDownLeft, FileText, 
  ChevronRight, ChevronLeft, Car, Home, PieChart as PieChartIcon, User, MoreVertical, 
  ArrowLeft, Plus, Building2, GraduationCap, ArrowRight,
  TrendingUp, Rocket, X, BarChart3, Bell, Shield, HelpCircle, Sparkles,
  Coffee, ShoppingBag, Smartphone, Utensils, Plane, Trash2,
  Mail, Lock, Facebook, Goal, Edit2, CreditCard, Wallet,
  Download, Eye, EyeOff, AlertTriangle, BellOff, RefreshCw,
  Camera, Receipt, Search, Check
} from 'lucide-react';

import { ReceiptScannerScreen } from './components/ReceiptScannerScreen';
import { PremiumPaywall } from './components/PremiumPaywall';
import { PullToRefresh } from './components/PullToRefresh';
import RotatingText from './components/ui/RotatingText';
import { authClient } from './lib/auth-client';
import { loadUserData, saveUserData } from './lib/firestore';
import { 
  fetchPostgresUserProfile, 
  updatePostgresUserProfile, 
  fetchPostgresTransactions, 
  createPostgresTransaction, 
  deletePostgresTransaction 
} from './lib/postgresApi';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatAmount, getDynamicBalanceFontSize } from './utils/formatCurrency';
import { 
  calculateBudgetMetrics, 
  calculateAdaptiveDailyRunway, 
  getDaysInMonth, 
  getRemainingDaysInMonth,
  type BudgetBreakdown 
} from './utils/financialCalculations';
import { WifiOff } from 'lucide-react';
import { NetworkStatusPage } from './components/NetworkStatusPage';
import { ScreenSkeleton } from './components/AppSkeleton';
import { useNetworkHealth } from './hooks/useNetworkHealth';
import { SmartHomeWelcomeScreen } from './components/SmartHomeWelcomeScreen';

export type Screen = 'home' | 'analytics' | 'history' | 'profile' | 'add_expense' | 'budget' | 'transaction_detail' | 'personal_info' | 'security' | 'notifications' | 'help_support' | 'edit_transaction' | 'settings' | 'rewards' | 'payments' | 'receipt_scanner' | 'welcome';

type Transaction = {
  id: string;
  type: 'topup' | 'send' | 'withdraw' | 'expense';
  amount: number;
  title: string;
  subtitle: string;
  time: string;
  date: string;
  category?: string;
};

// Initial Data
const INITIAL_BALANCE = 0.00;
const INITIAL_TRANSACTIONS: Transaction[] = [];

// Screen Animation Strategy Configuration for Native App Feeling
const TAB_INDEX_MAP: Record<string, number> = {
  home: 0,
  analytics: 1,
  receipt_scanner: 2,
  add_expense: 3,
  profile: 5,
};

const MODAL_SCREENS_SET = new Set([
  'add_expense',
  'budget',
  'transaction_detail',
  'edit_transaction',
]);

const SUB_SCREENS_SET = new Set([
  'history',
  'personal_info',
  'security',
  'notifications',
  'settings',
  'help_support',
  'rewards',
  'payments',
]);

function getScreenTransitionProps(screenKey: string, activeScreen: string, prevScreen: string) {
  const isModal = MODAL_SCREENS_SET.has(screenKey);
  const isSub = SUB_SCREENS_SET.has(screenKey);
  const isTab = TAB_INDEX_MAP[screenKey] !== undefined;

  const prevIsTab = TAB_INDEX_MAP[prevScreen] !== undefined;
  const prevIdx = TAB_INDEX_MAP[prevScreen] ?? 0;
  const currIdx = TAB_INDEX_MAP[screenKey] ?? 0;
  const isMovingRight = currIdx >= prevIdx;

  if (isModal) {
    return {
      initial: { y: '100%', opacity: 0, scale: 0.98 },
      animate: { y: '0%', opacity: 1, scale: 1 },
      exit: { y: '100%', opacity: 0, scale: 0.96 },
      transition: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }
    };
  }

  if (isSub) {
    return {
      initial: { x: '100%', opacity: 0 },
      animate: { x: '0%', opacity: 1 },
      exit: { x: '100%', opacity: 0 },
      transition: { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }
    };
  }

  if (isTab && prevIsTab) {
    return {
      initial: { x: isMovingRight ? '100%' : '-100%', opacity: 0, scale: 0.98 },
      animate: { x: '0%', opacity: 1, scale: 1 },
      exit: { x: isMovingRight ? '-30%' : '30%', opacity: 0, scale: 0.95 },
      transition: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }
    };
  }

  return {
    initial: { scale: 0.95, opacity: 0, y: 15 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.95, opacity: 0, y: -15 },
    transition: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }
  };
}

export default function App() {
  const { isOnline, isChecking, checkConnectivity } = useNetworkHealth();
  const [isScreenLoading, setIsScreenLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
      // When splash dismisses, show shimmering skeleton briefly if online
      setIsScreenLoading(true);
      const skelTimer = setTimeout(() => {
        setIsScreenLoading(false);
      }, 700);
      return () => clearTimeout(skelTimer);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('smart-expenses-logged-in') === 'true';
  });
  
  const [hasCompletedSetup, setHasCompletedSetup] = useState(() => {
    return localStorage.getItem('smart-expenses-setup') === 'true';
  });

  const [showWelcomeScreen, setShowWelcomeScreen] = useState(() => {
    return localStorage.getItem('smart-expenses-welcome-seen') !== 'true';
  });

  const [user, setUser] = useState<{ displayName: string | null; photoURL: string | null; uid?: string } | null>(() => {
    const saved = localStorage.getItem('smart-expenses-user');
    try { return saved ? JSON.parse(saved) : null; } catch(e) { return null; }
  });

  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [prevScreen, setPrevScreen] = useState<Screen>('home');
  const prevScreenRef = useRef<Screen>('home');

  useEffect(() => {
    if (activeScreen !== prevScreenRef.current) {
      setPrevScreen(prevScreenRef.current);
      prevScreenRef.current = activeScreen;
    }
  }, [activeScreen]);

  const handleNavigateScreen = (nextScreen: Screen) => {
    // If offline or disconnected, immediately verify and block navigation
    if (!navigator.onLine || !isOnline) {
      checkConnectivity();
      return;
    }

    if (nextScreen !== activeScreen) {
      // Trigger skeleton shimmer effect on major screens when online
      if (['home', 'analytics', 'history', 'profile', 'receipt_scanner', 'payments'].includes(nextScreen)) {
        setIsScreenLoading(true);
        setActiveScreen(nextScreen);
        setTimeout(() => {
          setIsScreenLoading(false);
        }, 450);
      } else {
        setActiveScreen(nextScreen);
      }
    }
  };

  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  
  // State
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('smart-expenses-balance');
    return saved ? parseFloat(saved) : INITIAL_BALANCE;
  });
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('smart-expenses-transactions');
    try { return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS; } catch(e) { return INITIAL_TRANSACTIONS; }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'topup' | 'send' | 'withdraw'>('topup');

  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem('smart-expenses-budget');
    return saved ? parseFloat(saved) : 0;
  });

  const [dailyLimit, setDailyLimit] = useState(() => {
    const saved = localStorage.getItem('smart-expenses-daily-limit');
    return saved ? parseFloat(saved) : 0;
  });

  const [dailySpendingNote, setDailySpendingNote] = useState(() => {
    return localStorage.getItem('smart-expenses-daily-note') || '';
  });

  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem('smart-expenses-currency') || 'USD';
  });

  const [currencySymbol, setCurrencySymbol] = useState(() => {
    return localStorage.getItem('smart-expenses-currency-symbol') || '$';
  });


  const [lastMonth, setLastMonth] = useState(() => {
    return localStorage.getItem('smart-expenses-last-month') || new Date().getMonth().toString();
  });

  const [monthlyHistory, setMonthlyHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('smart-expenses-history');
    try { return saved ? JSON.parse(saved) : []; } catch(e) { return []; }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    return localStorage.getItem('smart-expenses-is-premium') === 'true';
  });

  const [notifications, setNotifications] = useState<{
    id: string;
    type: 'warning' | 'critical' | 'info';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  }[]>(() => {
    const saved = localStorage.getItem('smart-expenses-notifications-list');
    try { return saved ? JSON.parse(saved) : []; } catch(e) { return []; }
  });

  const [notificationsReferrer, setNotificationsReferrer] = useState<'home' | 'profile'>('home');

  const [toast, setToast] = useState<{
    id: string;
    type: 'warning' | 'critical' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Auto-dismiss Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sync notificationsReferrer on active screen changes
  useEffect(() => {
    if (activeScreen === 'home' || activeScreen === 'profile') {
      setNotificationsReferrer(activeScreen);
    }
  }, [activeScreen]);

  // Generate Budget Notifications automatically
  useEffect(() => {
    if (budget <= 0) return;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthExpenses = transactions
      .filter((t: Transaction) => {
        if (t.type !== 'expense') return false;
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc: number, t: Transaction) => acc + t.amount, 0);

    const percent = (currentMonthExpenses / budget) * 100;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

    setNotifications(prev => {
      let updated = [...prev];
      let changed = false;
      let toastToTrigger: any = null;

      // 80% warning logic
      const has80 = updated.some(n => n.id === `budget-80-${currentMonth}-${currentYear}`);
      if (percent >= 80 && !has80) {
        const msg = `You have hit 80% of your budget. Spent ${currencySymbol}${currentMonthExpenses.toFixed(0)} of ${currencySymbol}${budget.toFixed(0)}.`;
        updated.unshift({
          id: `budget-80-${currentMonth}-${currentYear}`,
          type: 'warning',
          title: 'Budget Warning (80%+)',
          message: msg,
          timestamp,
          read: false
        });
        changed = true;
        toastToTrigger = {
          id: `toast-80-${Date.now()}`,
          type: 'warning',
          title: 'Budget Warning (80%+)',
          message: msg
        };
      } else if (percent < 80 && has80) {
        updated = updated.filter(n => n.id !== `budget-80-${currentMonth}-${currentYear}`);
        changed = true;
      }

      // 100% warning logic
      const has100 = updated.some(n => n.id === `budget-100-${currentMonth}-${currentYear}`);
      if (percent >= 100 && !has100) {
        const msg = `Alert: Spent 100% of budget! Spent ${currencySymbol}${currentMonthExpenses.toFixed(0)} of ${currencySymbol}${budget.toFixed(0)}.`;
        updated.unshift({
          id: `budget-100-${currentMonth}-${currentYear}`,
          type: 'critical',
          title: 'Budget Exceeded (100%+)',
          message: msg,
          timestamp,
          read: false
        });
        changed = true;
        toastToTrigger = {
          id: `toast-100-${Date.now()}`,
          type: 'critical',
          title: 'Budget Exceeded (100%+)',
          message: msg
        };
      } else if (percent < 100 && has100) {
        updated = updated.filter(n => n.id !== `budget-100-${currentMonth}-${currentYear}`);
        changed = true;
      }

      if (changed) {
        localStorage.setItem('smart-expenses-notifications-list', JSON.stringify(updated));
        if (toastToTrigger) {
          setTimeout(() => setToast(toastToTrigger), 0);
        }
        return updated;
      }
      return prev;
    });
  }, [transactions, budget, currencySymbol]);

  // Mark all as read when opening notifications screen
  useEffect(() => {
    if (activeScreen === 'notifications') {
      setNotifications(prev => {
        if (prev.some(n => !n.read)) {
          const updated = prev.map(n => ({ ...n, read: true }));
          localStorage.setItem('smart-expenses-notifications-list', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [activeScreen]);

  // Monthly Reset Logic
  useEffect(() => {
    const checkMonthlyReset = () => {
      const now = new Date();
      const currentMonth = now.getMonth().toString();
      
      // Reset if the month has changed, capturing the previous month's stats.
      if (isLoggedIn && currentMonth !== lastMonth) {
        const prevMonthExpenses = transactions.filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' && d.getMonth() === parseInt(lastMonth);
        }).reduce((sum, t) => sum + t.amount, 0);
        
        const prevMonthIncomes = transactions.filter(t => {
          const d = new Date(t.date);
          return t.type !== 'expense' && d.getMonth() === parseInt(lastMonth);
        }).reduce((sum, t) => sum + t.amount, 0);
        
        const historyItem = {
          id: Math.random().toString(36).substr(2, 9),
          month: parseInt(lastMonth),
          year: parseInt(lastMonth) === 11 && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
          expenses: prevMonthExpenses,
          incomes: prevMonthIncomes,
          balance,
          budget,
          currencySymbol
        };
        
        const updatedHistory = [historyItem, ...monthlyHistory];
        setMonthlyHistory(updatedHistory);
        localStorage.setItem('smart-expenses-history', JSON.stringify(updatedHistory));
        
        setLastMonth(currentMonth);
        localStorage.setItem('smart-expenses-last-month', currentMonth);
      }
    };

    // Run check immediately on mount and updates
    checkMonthlyReset();
    
    // Background interval check every hour for long-running sessions
    const intervalId = setInterval(checkMonthlyReset, 1000 * 60 * 60);
    return () => clearInterval(intervalId);
  }, [isLoggedIn, lastMonth, transactions, balance, budget, monthlyHistory, currencySymbol]);

  // Persistence (Instant LocalStorage + Debounced Firestore Sync)
  useEffect(() => {
    if (isSyncing) return; // Prevent overwriting cloud data while loading

    // Instant local storage writes
    localStorage.setItem('smart-expenses-balance', balance.toString());
    localStorage.setItem('smart-expenses-transactions', JSON.stringify(transactions));
    localStorage.setItem('smart-expenses-logged-in', isLoggedIn.toString());
    localStorage.setItem('smart-expenses-setup', hasCompletedSetup.toString());
    localStorage.setItem('smart-expenses-budget', budget.toString());
    localStorage.setItem('smart-expenses-daily-limit', dailyLimit.toString());
    localStorage.setItem('smart-expenses-daily-note', dailySpendingNote);
    localStorage.setItem('smart-expenses-user', JSON.stringify(user));
    localStorage.setItem('smart-expenses-currency', currency);
    localStorage.setItem('smart-expenses-currency-symbol', currencySymbol);
    localStorage.setItem('smart-expenses-last-month', lastMonth);
    localStorage.setItem('smart-expenses-is-premium', isPremium.toString());

    // Debounce Firestore cloud save (800ms) for maximum app speed and minimal network overhead
    let firestoreTimer: NodeJS.Timeout;
    if (user?.uid && !user.uid.startsWith('custom_')) {
      firestoreTimer = setTimeout(() => {
        saveUserData(user.uid!, {
          balance,
          transactions,
          budget,
          dailyLimit,
          dailySpendingNote,
          currency,
          currencySymbol,
          monthlyHistory,
          lastMonth,
          hasCompletedSetup,
          isPremium
        });
      }, 800);
    }

    return () => {
      if (firestoreTimer) clearTimeout(firestoreTimer);
    };
  }, [balance, transactions, isLoggedIn, hasCompletedSetup, budget, user, currency, currencySymbol, lastMonth, monthlyHistory, dailyLimit, dailySpendingNote, isPremium, isSyncing]);

  const handleAction = (type: 'topup' | 'send' | 'withdraw') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleAddTransaction = async (amount: number, title: string, subtitle: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: modalType,
      amount,
      title,
      subtitle,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString()
    };

    setTransactions(prev => [newTransaction, ...prev]);

    if (modalType === 'topup' || modalType === 'withdraw') {
      setBalance(prev => prev + amount);
    } else {
      setBalance(prev => prev - amount);
    }

    // Persist to PostgreSQL (Cloud SQL)
    if (user?.uid) {
      createPostgresTransaction(user.uid, {
        type: modalType,
        amount,
        title,
        subtitle,
        category: modalType,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }).then(res => {
        if (res?.newBalance !== undefined) {
          setBalance(res.newBalance);
        }
      }).catch(e => console.warn('PostgreSQL save error:', e));
    }
  };

  const handleAddExpense = async (amount: number, category: string, note: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount,
      title: category,
      subtitle: note || 'Expense',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString(),
      category
    };

    setTransactions(prev => [newTransaction, ...prev]);
    setBalance(prev => prev - amount);
    setActiveScreen('home');

    // Persist to PostgreSQL (Cloud SQL)
    if (user?.uid) {
      createPostgresTransaction(user.uid, {
        type: 'expense',
        amount,
        title: category,
        subtitle: note || 'Expense',
        category,
        note,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }).then(res => {
        if (res?.newBalance !== undefined) {
          setBalance(res.newBalance);
        }
      }).catch(e => console.warn('PostgreSQL expense error:', e));
    }
  };

  const handleAddReceiptExpense = async (expense: { amount: number; title: string; subtitle: string; category: string; date: string }) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'expense',
      amount: expense.amount,
      title: expense.title,
      subtitle: expense.subtitle || `AI Receipt Scan • ${expense.category}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: expense.date || new Date().toISOString(),
      category: expense.category
    };

    setTransactions(prev => [newTransaction, ...prev]);
    setBalance(prev => prev - expense.amount);
    setActiveScreen('home');

    // Persist to PostgreSQL (Cloud SQL)
    if (user?.uid) {
      createPostgresTransaction(user.uid, {
        type: 'expense',
        amount: expense.amount,
        title: expense.title,
        subtitle: expense.subtitle || `AI Receipt Scan • ${expense.category}`,
        category: expense.category,
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }).then(res => {
        if (res?.newBalance !== undefined) {
          setBalance(res.newBalance);
        }
      }).catch(e => console.warn('PostgreSQL receipt expense error:', e));
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const txToDelete = transactions.find(t => t.id === id);
    if (!txToDelete) return;
    
    setTransactions(prev => prev.filter(t => t.id !== id));
    
    if (txToDelete.type === 'topup') {
      setBalance(prev => prev - txToDelete.amount);
    } else {
      setBalance(prev => prev + txToDelete.amount);
    }

    // Delete from PostgreSQL
    if (user?.uid) {
      deletePostgresTransaction(user.uid, id).catch(e => console.warn('PostgreSQL delete error:', e));
    }
  };

  const handleSetupComplete = async (initialBalance: number, initialBudget: number, selectedCurrency: string, selectedSymbol: string, initialDailyLimit?: number) => {
    setBalance(initialBalance);
    setBudget(initialBudget);
    const remainingDays = getRemainingDaysInMonth();
    const computedDaily = initialDailyLimit !== undefined && !isNaN(initialDailyLimit) && initialDailyLimit > 0 
      ? initialDailyLimit 
      : Math.round(initialBudget / remainingDays);
    setDailyLimit(computedDaily);
    setCurrency(selectedCurrency);
    setCurrencySymbol(selectedSymbol);
    setHasCompletedSetup(true);

    // Save immediately to localStorage
    localStorage.setItem('smart-expenses-setup', 'true');
    localStorage.setItem('smart-expenses-balance', initialBalance.toString());
    localStorage.setItem('smart-expenses-budget', initialBudget.toString());
    localStorage.setItem('smart-expenses-daily-limit', computedDaily.toString());
    localStorage.setItem('smart-expenses-currency', selectedCurrency);
    localStorage.setItem('smart-expenses-currency-symbol', selectedSymbol);

    // Persist to PostgreSQL (Cloud SQL)
    if (user?.uid) {
      updatePostgresUserProfile(user.uid, {
        balance: initialBalance,
        budget: initialBudget,
        currency: selectedCurrency,
        currencySymbol: selectedSymbol,
      }).catch(e => console.warn('PostgreSQL profile update error:', e));
    }

    // Save immediately to Firestore (instant write without debounce)
    if (user?.uid && !user.uid.startsWith('custom_')) {
      saveUserData(user.uid, {
        balance: initialBalance,
        budget: initialBudget,
        dailyLimit: computedDaily,
        currency: selectedCurrency,
        currencySymbol: selectedSymbol,
        hasCompletedSetup: true,
        transactions,
        monthlyHistory,
        lastMonth,
        isPremium
      });
    }
  };

  const handleLogin = async (userData: { displayName: string | null; photoURL: string | null; uid?: string; email?: string }) => {
    setUser(userData);
    setIsLoggedIn(true);
    setShowWelcomeScreen(true);

    const localSetup = localStorage.getItem('smart-expenses-setup') === 'true';

    if (userData.uid) {
      setIsSyncing(true);
      try {
        // Sync user in PostgreSQL backend
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userData.uid}`,
            'x-user-email': userData.email || 'user@example.com',
          },
          body: JSON.stringify({}),
        }).catch(err => console.warn('Auth sync error:', err));

        // Load profile and transactions from PostgreSQL
        const [pgProfile, pgTransactions] = await Promise.all([
          fetchPostgresUserProfile(userData.uid),
          fetchPostgresTransactions(userData.uid),
        ]);

        let loadedFromPg = false;
        if (pgProfile) {
          loadedFromPg = true;
          if (typeof pgProfile.balance === 'number') setBalance(pgProfile.balance);
          if (typeof pgProfile.budget === 'number') setBudget(pgProfile.budget);
          if (pgProfile.currency) setCurrency(pgProfile.currency);
          if (pgProfile.currencySymbol) setCurrencySymbol(pgProfile.currencySymbol);
          if (pgProfile.isPremium !== null && pgProfile.isPremium !== undefined) setIsPremium(pgProfile.isPremium);
        }

        if (pgTransactions && pgTransactions.length > 0) {
          loadedFromPg = true;
          const mapped: Transaction[] = pgTransactions.map(t => ({
            id: t.id.toString(),
            type: t.type as any,
            amount: t.amount,
            title: t.title || (t.type === 'topup' ? 'Top Up' : 'Expense'),
            subtitle: t.subtitle || t.category || '',
            time: t.time || '',
            date: t.date,
            category: t.category || undefined,
          }));
          setTransactions(mapped);
        }

        if (!loadedFromPg && !userData.uid.startsWith('custom_')) {
          // Fallback to Firestore for legacy data
          const data = await loadUserData(userData.uid);
          if (data) {
            setBalance(data.balance ?? 0);
            setTransactions(data.transactions ?? []);
            setBudget(data.budget ?? 0);
            setDailyLimit(data.dailyLimit ?? 0);
            setDailySpendingNote(data.dailySpendingNote ?? '');
            setCurrency(data.currency ?? 'USD');
            setCurrencySymbol(data.currencySymbol ?? '$');
            setMonthlyHistory(data.monthlyHistory ?? []);
            setLastMonth(data.lastMonth ?? new Date().getMonth().toString());
            setIsPremium(data.isPremium ?? false);

            // Seed into PostgreSQL
            updatePostgresUserProfile(userData.uid, {
              balance: data.balance ?? 0,
              budget: data.budget ?? 0,
              currency: data.currency ?? 'USD',
              currencySymbol: data.currencySymbol ?? '$',
            }).catch(e => console.warn('Seeding PostgreSQL error:', e));
          }
        }

        const setupDone = Boolean(pgProfile?.budget && pgProfile.budget > 0) || localSetup;
        setHasCompletedSetup(setupDone);
        localStorage.setItem('smart-expenses-setup', setupDone.toString());
      } catch (err) {
        console.error('Error loading data from PostgreSQL:', err);
      } finally {
        setIsSyncing(false);
      }
    } else {
      setBalance(0);
      setTransactions([]);
      setBudget(0);
      setDailySpendingNote('');
      setHasCompletedSetup(localSetup);
      localStorage.setItem('smart-expenses-setup', localSetup.toString());
    }
  };

  const handleRefreshData = async () => {
    if (user?.uid) {
      setIsSyncing(true);
      try {
        const [pgProfile, pgTransactions] = await Promise.all([
          fetchPostgresUserProfile(user.uid),
          fetchPostgresTransactions(user.uid),
        ]);

        if (pgProfile) {
          if (typeof pgProfile.balance === 'number') setBalance(pgProfile.balance);
          if (typeof pgProfile.budget === 'number') setBudget(pgProfile.budget);
          if (pgProfile.currency) setCurrency(pgProfile.currency);
          if (pgProfile.currencySymbol) setCurrencySymbol(pgProfile.currencySymbol);
          if (pgProfile.isPremium !== null && pgProfile.isPremium !== undefined) setIsPremium(pgProfile.isPremium);
        }

        if (pgTransactions && pgTransactions.length > 0) {
          const mapped: Transaction[] = pgTransactions.map(t => ({
            id: t.id.toString(),
            type: t.type as any,
            amount: t.amount,
            title: t.title || (t.type === 'topup' ? 'Top Up' : 'Expense'),
            subtitle: t.subtitle || t.category || '',
            time: t.time || '',
            date: t.date,
            category: t.category || undefined,
          }));
          setTransactions(mapped);
        }
      } catch (err) {
        console.error('Error re-syncing from PostgreSQL:', err);
      } finally {
        setIsSyncing(false);
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  };

  const handleUpdateProfilePicture = (newPhotoURL: string) => {
    setUser(prev => prev ? { ...prev, photoURL: newPhotoURL } : { displayName: 'Guest User', photoURL: newPhotoURL, uid: `custom_${Date.now()}` });
  };

  const handleLogout = () => {
    authClient.signOut({}).catch(() => {});
    clearUserData();
  };

  const clearUserData = () => {
    setUser(null);
    setIsLoggedIn(false);
    setHasCompletedSetup(false);
    setBalance(0);
    setTransactions([]);
    setBudget(0);
    setIsPremium(false);
    localStorage.removeItem('smart-expenses-balance');
    localStorage.removeItem('smart-expenses-transactions');
    localStorage.removeItem('smart-expenses-logged-in');
    localStorage.removeItem('smart-expenses-setup');
    localStorage.removeItem('smart-expenses-budget');
    localStorage.removeItem('smart-expenses-user');
    localStorage.removeItem('smart-expenses-is-premium');
    localStorage.removeItem('smart-expenses-welcome-seen');
    setShowWelcomeScreen(true);
  };

  if (!isOnline) {
    return (
      <NetworkStatusPage 
        onRetry={async () => {
          const ok = await checkConnectivity();
          if (ok) {
            setIsScreenLoading(true);
            setTimeout(() => {
              setIsScreenLoading(false);
            }, 650);
          }
          return ok;
        }} 
        isChecking={isChecking} 
      />
    );
  }

  if (showSplash) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-[#F2F2F7] dark:bg-black font-sans selection:bg-black selection:text-white flex justify-center overflow-hidden">
        <div className="w-full h-full max-w-md bg-[#F2F2F7] dark:bg-black relative overflow-y-auto flex flex-col mx-auto">
          <SplashScreen />
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-[#F2F2F7] dark:bg-black font-sans selection:bg-black selection:text-white flex justify-center overflow-hidden">
        <div className="w-full h-full max-w-md bg-[#F2F2F7] dark:bg-black relative overflow-y-auto flex flex-col mx-auto">
          <LoginScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  if (showWelcomeScreen) {
    return (
      <SmartHomeWelcomeScreen 
        onGetStarted={() => {
          setShowWelcomeScreen(false);
          localStorage.setItem('smart-expenses-welcome-seen', 'true');
        }}
      />
    );
  }

  if (!hasCompletedSetup) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const previousMonthIndex = parseInt(lastMonth);
    const previousMonthName = !isNaN(previousMonthIndex) && previousMonthIndex >= 0 && previousMonthIndex <= 11 ? monthNames[previousMonthIndex] : "previous";
    
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-[#F2F2F7] dark:bg-black font-sans selection:bg-black selection:text-white flex justify-center overflow-hidden">
        <div className="w-full h-full max-w-md bg-[#F2F2F7] dark:bg-black relative overflow-y-auto flex flex-col mx-auto">
          <SetupScreen onComplete={handleSetupComplete} isNewMonth={monthlyHistory.length > 0} previousMonthName={previousMonthName} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#F2F2F7] dark:bg-black font-sans selection:bg-black selection:text-white flex justify-center overflow-hidden">
      {/* Mobile Device Container - Responsive for actual mobile */}
      <div className="w-full h-full max-w-md bg-[#F2F2F7] dark:bg-black relative flex flex-col mx-auto overflow-hidden">
        {isScreenLoading ? (
          <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScreenSkeleton screen={activeScreen} />
          </div>
        ) : (
        <AnimatePresence mode="wait">
          {activeScreen === 'home' && (
            <motion.div 
              key="home" 
              {...getScreenTransitionProps('home', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <HomeScreen 
                user={user}
                balance={balance} 
                budget={budget}
                setBudget={setBudget}
                dailyLimit={dailyLimit}
                setDailyLimit={setDailyLimit}
                dailySpendingNote={dailySpendingNote}
                setDailySpendingNote={setDailySpendingNote}
                transactions={transactions} 
                currencySymbol={currencySymbol}
                currency={currency}
                onAction={handleAction} 
                onNavigateScreen={handleNavigateScreen}
                onTransactionSelect={(id: string) => { setSelectedTxId(id); handleNavigateScreen('transaction_detail'); }}
                onLogout={handleLogout}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </motion.div>
          )}
          {activeScreen === 'budget' && (
            <motion.div 
              key="budget" 
              {...getScreenTransitionProps('budget', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <BudgetScreen 
                budget={budget}
                setBudget={setBudget}
                dailyLimit={dailyLimit}
                setDailyLimit={setDailyLimit}
                currencySymbol={currencySymbol}
                balance={balance}
                history={monthlyHistory}
                onBack={() => setActiveScreen('home')} 
              />
            </motion.div>
          )}
          {activeScreen === 'add_expense' && (
            <motion.div 
              key="add_expense" 
              {...getScreenTransitionProps('add_expense', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <AddExpenseScreen 
                currencySymbol={currencySymbol}
                onSave={handleAddExpense}
                onBack={() => setActiveScreen('home')} 
              />
            </motion.div>
          )}
          {activeScreen === 'analytics' && (
            <motion.div 
              key="analytics" 
              {...getScreenTransitionProps('analytics', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {isPremium ? (
                <AnalyticsScreen user={user} currencySymbol={currencySymbol} currency={currency} transactions={transactions} history={monthlyHistory} onBack={() => handleNavigateScreen('home')} />
              ) : (
                <PremiumPaywall onUpgradeSuccess={() => { setIsPremium(true); handleNavigateScreen('analytics'); }} onBack={() => handleNavigateScreen('home')} />
              )}
            </motion.div>
          )}
          {activeScreen === 'payments' && (
            <motion.div 
              key="payments" 
              {...getScreenTransitionProps('payments', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <PremiumPaywall isPremium={isPremium} onResetPremium={() => setIsPremium(false)} onUpgradeSuccess={() => { setIsPremium(true); handleNavigateScreen('analytics'); }} onBack={() => handleNavigateScreen('home')} />
            </motion.div>
          )}
          {activeScreen === 'history' && (
            <motion.div 
              key="history" 
              {...getScreenTransitionProps('history', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <HistoryScreen currencySymbol={currencySymbol} currency={currency} transactions={transactions} onBack={() => handleNavigateScreen('home')} onTransactionSelect={(id: string) => { setSelectedTxId(id); handleNavigateScreen('transaction_detail'); }} onDeleteTransaction={handleDeleteTransaction} />
            </motion.div>
          )}
          {activeScreen === 'profile' && (
            <motion.div 
              key="profile" 
              {...getScreenTransitionProps('profile', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <ProfileScreen user={user} isPremium={isPremium} onLogout={handleLogout} onBack={() => handleNavigateScreen('home')} onNavigate={handleNavigateScreen} onUpdateProfilePicture={handleUpdateProfilePicture} onResetPremium={() => setIsPremium(false)} />
            </motion.div>
          )}
          {activeScreen === 'welcome' && (
            <motion.div 
              key="welcome" 
              {...getScreenTransitionProps('profile', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <SmartHomeWelcomeScreen 
                onGetStarted={() => {
                  handleNavigateScreen('home');
                  localStorage.setItem('smart-expenses-welcome-seen', 'true');
                }}
              />
            </motion.div>
          )}
          {activeScreen === 'transaction_detail' && selectedTxId && (
            <motion.div 
              key="transaction_detail" 
              {...getScreenTransitionProps('transaction_detail', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <TransactionDetailScreen 
                transaction={transactions.find(t => t.id === selectedTxId)}
                currencySymbol={currencySymbol}
                currency={currency}
                onBack={() => { setActiveScreen('home'); setSelectedTxId(null); }}
                onDelete={(id) => { handleDeleteTransaction(id); setActiveScreen('home'); setSelectedTxId(null); }}
                onEdit={() => { setActiveScreen('edit_transaction'); }}
              />
            </motion.div>
          )}
          {activeScreen === 'edit_transaction' && selectedTxId && (
            <motion.div 
              key="edit_transaction" 
              {...getScreenTransitionProps('edit_transaction', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <EditTransactionScreen 
                transaction={transactions.find(t => t.id === selectedTxId)}
                currencySymbol={currencySymbol}
                onBack={() => setActiveScreen('transaction_detail')}
                onSave={(id, newAmount, newTitle) => {
                  if (navigator.vibrate) navigator.vibrate(50);
                  const updatedTransactions = transactions.map(t => {
                    if (t.id === id) {
                      const amountDiff = newAmount - t.amount;
                      if (t.type === 'expense') setBalance(prev => prev - amountDiff);
                      else setBalance(prev => prev + amountDiff);
                      return { ...t, amount: newAmount, title: newTitle };
                    }
                    return t;
                  });
                  setTransactions(updatedTransactions);
                  setActiveScreen('transaction_detail');
                }}
              />
            </motion.div>
          )}
          {['personal_info', 'security', 'notifications', 'settings'].includes(activeScreen) && (
            <motion.div 
              key={activeScreen} 
              {...getScreenTransitionProps(activeScreen, activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <GenericSubScreen 
                title={activeScreen.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                onBack={() => {
                  if (activeScreen === 'notifications') {
                    setActiveScreen(notificationsReferrer);
                  } else {
                    setActiveScreen('profile');
                  }
                }}
                transactions={transactions}
                budget={budget}
                currencySymbol={currencySymbol}
                notifications={notifications}
                setNotifications={setNotifications}
                user={user}
                isPremium={isPremium}
              />
            </motion.div>
          )}
          {activeScreen === 'help_support' && (
            <motion.div 
              key="help_support" 
              {...getScreenTransitionProps('help_support', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <HelpSupportScreen onBack={() => setActiveScreen('profile')} />
            </motion.div>
          )}
          {activeScreen === 'rewards' && (
            <motion.div 
              key="rewards" 
              {...getScreenTransitionProps('rewards', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <RewardsLoyaltyScreen onBack={() => setActiveScreen('profile')} />
            </motion.div>
          )}
          {activeScreen === 'receipt_scanner' && (
            <motion.div 
              key="receipt_scanner" 
              {...getScreenTransitionProps('receipt_scanner', activeScreen, prevScreen)}
              className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden z-50"
            >
              <ReceiptScannerScreen 
                currencySymbol={currencySymbol}
                isPremium={isPremium}
                onBack={() => handleNavigateScreen('home')}
                onNavigate={handleNavigateScreen}
                onAddExpense={handleAddReceiptExpense}
              />
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {['home', 'analytics', 'history', 'profile', 'payments', 'receipt_scanner'].includes(activeScreen) && (
          <BottomNavigationBar active={activeScreen} onNavigate={handleNavigateScreen} />
        )}

        {/* Transaction Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <TransactionModal 
              type={modalType} 
              onClose={() => setIsModalOpen(false)} 
              onSubmit={handleAddTransaction} 
            />
          )}
        </AnimatePresence>

        {/* Floating Custom Toast Alerts */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-[360px] z-[60] pointer-events-auto"
              id="toast-notification-container"
            >
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden backdrop-blur-md">
                {/* Left accent indicator bar */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                  toast.type === 'critical' ? 'bg-red-500' :
                  toast.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />

                {/* Toast Icon */}
                <div className="pl-1 flex-shrink-0 mt-0.5">
                  {toast.type === 'critical' ? (
                    <AlertTriangle className="w-5 h-5 text-red-500" id="toast-critical-icon" />
                  ) : toast.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-500" id="toast-warning-icon" />
                  ) : (
                    <Bell className="w-5 h-5 text-emerald-500" id="toast-success-icon" />
                  )}
                </div>

                {/* Toast Content */}
                <div className="flex-1 pr-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none mb-1">
                    {toast.title}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => setToast(null)}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
                  aria-label="Dismiss Notification"
                  id="toast-dismiss-button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// -----------------------------
// HOME SCREEN COMPONENT
// -----------------------------
let globalHasShownAlert = false;

const HomeScreen: React.FC<any> = ({ user, balance, budget, setBudget, dailyLimit, setDailyLimit, dailySpendingNote, setDailySpendingNote, transactions, currencySymbol, currency, onAction, onNavigateScreen, onTransactionSelect, onLogout, onDeleteTransaction }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState(budget.toString());

  const { totalExpenses, totalDailyExpenses, currentMonthExpenses } = useMemo(() => {
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
        const tMonth = d.getMonth();
        const tYear = d.getFullYear();
        if (tMonth === currentMonth && tYear === currentYear) {
          monthExp += t.amount;
          if (d.getDate() === todayDate) {
            dailyExp += t.amount;
          }
        }
      }
    }

    return {
      totalExpenses: monthExp,
      totalDailyExpenses: dailyExp,
      currentMonthExpenses: monthExp
    };
  }, [transactions]);

  const isOverBudget = budget > 0 && totalExpenses > budget;
  const isOverDailyLimit = dailyLimit > 0 && totalDailyExpenses > dailyLimit;
  const budgetRatio = budget > 0 ? (totalExpenses / budget) : 0;
  const dailyRatio = dailyLimit > 0 ? (totalDailyExpenses / dailyLimit) : 0;

  useEffect(() => {
    if (isOverBudget && !globalHasShownAlert) {
      if (navigator.vibrate) {
        // Vibrate pattern for alert: short, short
        navigator.vibrate([50, 50, 50]);
      }
      setShowAlertModal(true);
      globalHasShownAlert = true;
    } else if (!isOverBudget) {
      globalHasShownAlert = false;
    }
  }, [isOverBudget]);

  useGSAP(() => {
    // Scroll animations for transaction items
    if (containerRef.current?.querySelector('.gsap-tx-item')) {
      gsap.fromTo('.gsap-tx-item', 
        { opacity: 0, y: 30, scale: 0.95 },
        { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          stagger: 0.1,
          ease: "power2.out",
          duration: 0.6,
          scrollTrigger: {
            trigger: '.gsap-expenses-section',
            scroller: containerRef.current,
            start: 'top 85%',
          }
        }
      );
    }

    // Scroll animation for an image banner
    if (containerRef.current?.querySelector('.gsap-banner-img')) {
      gsap.fromTo('.gsap-banner-img',
        { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 1,
          ease: "back.out(1.2)",
          scrollTrigger: {
            trigger: '.gsap-banner-section',
            scroller: containerRef.current,
            start: 'top 80%'
          }
        }
      );
    }
  }, { scope: containerRef });

  const formattedBalanceStr = useMemo(() => {
    return formatAmount(balance, currencySymbol);
  }, [balance, currencySymbol]);

  const balanceFontSizeClass = useMemo(() => {
    return getDynamicBalanceFontSize(formattedBalanceStr.length);
  }, [formattedBalanceStr]);

  const todaysExpenses = useMemo(() => {
    const today = new Date();
    const tDate = today.getDate();
    const tMonth = today.getMonth();
    const tYear = today.getFullYear();

    const res = [];
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.type === 'expense') {
        const d = new Date(t.date);
        if (d.getDate() === tDate && d.getMonth() === tMonth && d.getFullYear() === tYear) {
          res.push(t);
          if (res.length === 5) break;
        }
      }
    }
    return res;
  }, [transactions]);

  const budgetPercentage = budget > 0 ? Math.min((currentMonthExpenses / budget) * 100, 100) : 0;

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

      {/* Continuous Live Marquee Ticker Ribbon (Blinkit/BigBasket Style) */}
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
        whileHover={{ scale: 1.03, y: -4, rotateX: 2, rotateY: -2 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
        className="mx-6 mt-4 bg-[#C5F531] rounded-[32px] p-6 relative overflow-hidden card-3d-effect min-h-[240px] flex flex-col justify-between cursor-pointer hover:shadow-2xl"
      >
        <div className="absolute right-[-40px] top-[-40px] w-32 h-32 bg-white dark:bg-[#1C1C1E]/20 rounded-full blur-2xl" />
        <div className="absolute left-[-20px] bottom-[-20px] w-24 h-24 bg-black/5 rounded-full blur-xl" />
        
        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0D2111] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0D2111]"></span>
              </span>
              <p className="text-[#0D2111]/80 text-[12px] font-extrabold uppercase tracking-widest">Total Balance</p>
            </div>
            <div className="flex items-end gap-2 overflow-hidden max-w-full">
              <h2 className={`text-[#0D2111] font-bold tracking-tighter transition-all duration-300 truncate ${balanceFontSizeClass}`}>{formattedBalanceStr}</h2>
            </div>
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

      {/* Budget Progress Section */}
      <motion.div 
        className="mx-6 mt-6 liquid-glass-card rounded-[24px] p-5 cursor-pointer shadow-sm"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigateScreen('budget')}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white tracking-tight">Monthly Budget</h3>
          <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${
            budgetRatio >= 0.95
              ? 'text-red-500 bg-red-100 dark:bg-red-500/10'
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
                    : budgetRatio >= 0.90
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
              <span className="text-gray-500 dark:text-gray-400 font-medium truncate">Limit {formatAmount(budget, currencySymbol)}</span>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Tap here to set your monthly spending limit.</p>
        )}
      </motion.div>

      {/* Daily Limit Section */}
      <motion.div 
        className="mx-6 mt-4 liquid-glass-card rounded-[24px] p-5 cursor-pointer shadow-sm"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigateScreen('budget')}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white tracking-tight">Daily Spending</h3>
          <span className={`text-[13px] font-bold px-2.5 py-1 rounded-full ${
            dailyRatio >= 0.95
              ? 'text-red-500 bg-red-100 dark:bg-red-500/10'
              : dailyRatio >= 0.80
              ? 'text-amber-500 bg-amber-100 dark:bg-amber-500/10'
              : 'text-[#34C759] bg-[#E5F7ED] dark:bg-[#34C759]/10'
          }`}>
            {dailyLimit > 0 ? `${(dailyRatio * 100).toFixed(0)}%` : 'Set Limit'}
          </span>
        </div>
        
        {dailyLimit > 0 ? (
          <>
            <div className="h-2 w-full bg-[#F2F2F7] dark:bg-black rounded-full overflow-hidden mb-2">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  dailyRatio >= 0.95
                    ? 'bg-red-500 budget-red-glow-100'
                    : dailyRatio >= 0.80
                    ? 'bg-amber-500 budget-pulse-80'
                    : 'bg-[#34C759]'
                }`} 
                style={{ width: `${Math.min(dailyRatio * 100, 100)}%` }} 
              />
            </div>
            <div className="flex justify-between items-center text-[13px] gap-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium truncate">Spent {formatAmount(totalDailyExpenses, currencySymbol)}</span>
              <span className={`font-semibold truncate ${
                dailyRatio >= 0.95 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : dailyRatio >= 0.80 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>Left {formatAmount(Math.max(0, dailyLimit - totalDailyExpenses), currencySymbol)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Tap here to set your daily spending limit.</p>
        )}

        {/* Optional Daily Spending Note Field */}
        <div 
          className="mt-3.5 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Edit2 size={13} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
          <input
            type="text"
            value={dailySpendingNote || ''}
            onChange={(e) => setDailySpendingNote?.(e.target.value)}
            placeholder="Jot down note (e.g., Dinner with friends)..."
            className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0 border-none p-0"
          />
          {dailySpendingNote && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDailySpendingNote?.('');
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
              title="Clear note"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Grouped Action Buttons in Subtle Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 100, damping: 20 }}
        className="mx-6 mt-6 p-3.5 rounded-[26px] bg-white/90 dark:bg-[#1C1C1E]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex justify-around items-center"
      >
        <CardAction icon={<Plus size={20} />} label="Topup" onClick={() => onAction('topup')} />
        <CardAction icon={<ArrowUpRight size={20} />} label="Send" onClick={() => onAction('send')} />
        <CardAction icon={<ArrowDownLeft size={20} />} label="Withdraw" onClick={() => onAction('withdraw')} />
        <CardAction icon={<Goal size={20} />} label="Budget" onClick={() => onNavigateScreen('budget')} />
      </motion.div>

      {/* Consolidated Single Prominent AI Scan Banner */}
      <motion.div 
        className="mt-6 px-6 gsap-banner-section cursor-pointer"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigateScreen('receipt_scanner')}
      >
        <div className="relative w-full rounded-[24px] overflow-hidden gsap-banner-img bg-[#0D2111] shadow-xl hover:shadow-2xl transition-all border border-white/10 flex items-center p-4">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-[#C5F531] opacity-20 blur-2xl rounded-full" />
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

      {/* Expenses Section */}
      <div className="mt-8 px-6 gsap-expenses-section">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-between items-center mb-5 gap-6"
        >
          <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Today's Expenses</h3>
          <button 
            onClick={() => onNavigateScreen('add_expense')} 
            className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/25 px-4 py-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Add Now</span>
            <Plus size={16} className="stroke-[2.5]" />
          </button>
        </motion.div>

        <div className="pb-6">
          {todaysExpenses.length === 0 ? (
            <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col items-center justify-center py-10 px-6 text-center bg-white dark:bg-[#1C1C1E] rounded-[32px] border border-gray-100 dark:border-zinc-800/80 cursor-pointer shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.2)] hover:shadow-[0_10px_35px_rgba(0,0,0,0.06)] transition-all group"
                onClick={() => onNavigateScreen('add_expense')}
              >
                <div className="w-16 h-16 bg-[#E6F8EF] dark:bg-[#10B981]/15 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <Plus size={28} className="text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                </div>
                <h4 className="text-zinc-900 dark:text-white text-lg font-extrabold tracking-tight mb-1">No expenses yet</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium tracking-normal">Add your today's expenses now.</p>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {todaysExpenses.map((tx: Transaction) => (
                  <motion.div 
                    key={tx.id} 
                    className="gsap-tx-item" 
                    layout
                    initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)', x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TransactionItem tx={tx} currency={currency} currencySymbol={currencySymbol} onClick={() => onTransactionSelect(tx.id)} onDelete={() => onDeleteTransaction(tx.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Custom Alert Modal */}
      <AnimatePresence>
        {showAlertModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-[#1C1C1E] rounded-[32px] p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-5 mx-auto relative z-10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </div>
              <h2 className="text-[22px] font-bold text-gray-900 dark:text-white text-center mb-2 relative z-10">Budget Exceeded!</h2>
              
              {!isEditingBudget ? (
                <>
                  <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-6 font-medium relative z-10">
                    You've spent {formatAmount(totalExpenses, currencySymbol)}, which is over your {formatAmount(budget, currencySymbol)} limit.
                  </p>
                  <div className="flex gap-3 relative z-10">
                    <button
                      onClick={() => setShowAlertModal(false)}
                      className="flex-1 h-12 bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white rounded-full font-bold text-[14px] active:scale-95 transition-transform"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => setIsEditingBudget(true)}
                      className="flex-1 h-12 bg-red-500 text-white rounded-full font-bold text-[14px] active:scale-95 transition-transform shadow-[0_4px_14px_rgba(239,68,68,0.4)]"
                    >
                      Update Limit
                    </button>
                  </div>
                </>
              ) : (
                <div className="relative z-10">
                  <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center mb-4 font-medium">
                    Set a new monthly budget limit.
                  </p>
                  <div className="relative mb-6">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[18px]">
                      {currencySymbol}
                    </div>
                    <input 
                      type="number"
                      inputMode="decimal"
                      value={newBudgetAmount}
                      onChange={(e) => setNewBudgetAmount(e.target.value)}
                      className="w-full h-14 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl pl-10 pr-4 font-bold text-[20px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white dark:bg-[#1C1C1E] transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditingBudget(false)}
                      className="flex-1 h-12 bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white rounded-full font-bold text-[14px] active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const amt = parseFloat(newBudgetAmount);
                        if (!isNaN(amt) && amt > 0) {
                          setBudget(amt);
                          setShowAlertModal(false);
                          setIsEditingBudget(false);
                          globalHasShownAlert = false;
                        }
                      }}
                      className="flex-1 h-12 bg-red-500 text-white rounded-full font-bold text-[14px] active:scale-95 transition-transform shadow-[0_4px_14px_rgba(239,68,68,0.4)]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// -----------------------------
// ADD EXPENSE SCREEN COMPONENT
// -----------------------------
const AddExpenseScreen: React.FC<any> = ({ onSave, onBack, currencySymbol = '$' }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');

  const categories = [
    { id: 'Food', name: 'Food', icon: <Utensils size={18} />, color: '#FF9500' },
    { id: 'Transport', name: 'Transport', icon: <Car size={18} />, color: '#007AFF' },
    { id: 'Shopping', name: 'Shopping', icon: <ShoppingBag size={18} />, color: '#AF52DE' },
    { id: 'Bills', name: 'Bills', icon: <Smartphone size={18} />, color: '#FF2D55' },
    { id: 'Travel', name: 'Travel', icon: <Plane size={18} />, color: '#5856D6' },
    { id: 'Other', name: 'Other', icon: <FileText size={18} />, color: '#8E8E93' },
  ];

  const quickAmounts = [5, 10, 25, 50, 100];
  const quickTags = ['Coffee ☕', 'Groceries 🛒', 'Taxi 🚕', 'Dinner 🍽️', 'Gas ⛽', 'Rent 🏠'];

  const addQuickAmount = (val: number) => {
    const current = Number(amount) || 0;
    setAmount((current + val).toString());
  };

  const handleSubmit = () => {
    if (!amount || isNaN(Number(amount))) return;
    const finalCategory = category === 'Other'
      ? (customCategory.trim() ? customCategory.trim() : 'Other')
      : category;
    onSave(Number(amount), finalCategory, note);
  };

  return (
    <motion.div 
      initial={{ y: '100%', opacity: 0.8 }} 
      animate={{ y: 0, opacity: 1 }} 
      exit={{ y: '100%', opacity: 0 }} 
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="fixed inset-0 bg-[#F8F9FA] dark:bg-[#0A0A0C] z-[100] flex flex-col h-full w-full overflow-hidden text-[#0D2111] dark:text-white"
    >
      {/* Top Header */}
      <div className="pt-12 px-6 pb-4 flex justify-between items-center shrink-0 border-b border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-[#0A0A0C]/80 backdrop-blur-xl z-20">
        <motion.button 
          whileHover={{ scale: 1.05, rotate: -90 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack} 
          className="w-10 h-10 bg-gray-100 dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#2C2C2E] transition-all cursor-pointer shadow-sm"
        >
          <X size={18} className="text-gray-800 dark:text-gray-200" />
        </motion.button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-mono tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">New Entry</span>
          <h1 className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-white">Add Expense</h1>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Scrollable Body */}
      <div className="flex-1 min-h-0 px-5 sm:px-8 py-6 overflow-y-auto overscroll-contain touch-pan-y space-y-6">
        
        {/* HERO AMOUNT DISPLAY CARD */}
        <div className="relative overflow-hidden rounded-[32px] p-6 sm:p-8 bg-gradient-to-b from-white to-gray-50/80 dark:from-[#141416] dark:to-[#0E0E10] border border-gray-200/80 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-none flex flex-col items-center justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5F531]/10 rounded-full blur-2xl pointer-events-none" />
          
          <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-emerald-600 dark:text-[#C5F531] mb-2">
            Expense Amount
          </span>

          <div className="flex items-center justify-center w-full my-2">
            <span className="text-[32px] sm:text-[42px] font-light text-gray-400 dark:text-gray-500 mr-2 font-sans select-none">
              {currencySymbol}
            </span>
            <input 
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-transparent outline-none w-full max-w-[280px] text-center font-black text-[52px] sm:text-[64px] tracking-tight placeholder:text-gray-300 dark:placeholder:text-gray-700 text-[#0D2111] dark:text-[#C5F531] transition-all"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {/* Quick Amount Adder Chips - Plus sign removed */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/5 w-full">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-1">Quick Add:</span>
            {quickAmounts.map(val => (
              <motion.button
                key={val}
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => addQuickAmount(val)}
                className="px-3 py-1.5 rounded-full text-xs font-extrabold bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 hover:border-[#C5F531] dark:hover:border-[#C5F531] text-gray-700 dark:text-gray-300 hover:text-[#0D2111] dark:hover:text-[#C5F531] transition-all cursor-pointer shadow-2xs"
              >
                {currencySymbol}{val}
              </motion.button>
            ))}
          </div>
        </div>

        {/* CATEGORY SELECTOR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400 font-bold">Category</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-[#C5F531]">
              {category === 'Other' && customCategory.trim() ? customCategory : category}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {categories.map(c => {
              const isSelected = category === c.id;
              return (
                <motion.button 
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-[24px] transition-all cursor-pointer border overflow-hidden ${
                    isSelected 
                      ? 'bg-[#0D2111] dark:bg-[#C5F531] border-[#0D2111] dark:border-[#C5F531] text-white dark:text-[#0D2111] shadow-lg shadow-black/10 dark:shadow-[#C5F531]/20' 
                      : 'bg-white dark:bg-[#141416] border-gray-200/80 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-[16px] flex items-center justify-center mb-2.5 transition-all ${
                    isSelected 
                      ? 'bg-[#C5F531] dark:bg-[#0D2111] text-[#0D2111] dark:text-[#C5F531]' 
                      : 'bg-gray-100 dark:bg-white/5 text-[#0D2111] dark:text-white'
                  }`}>
                    {c.icon}
                  </div>
                  <span className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                    isSelected ? 'text-white dark:text-[#0D2111]' : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {c.name}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Custom category input if 'Other' is selected */}
          {category === 'Other' && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-2 space-y-1.5"
            >
              <label className="text-xs font-mono tracking-wider uppercase text-emerald-600 dark:text-[#C5F531] font-bold px-1 flex items-center gap-1">
                <span>Category ka naam likhein (Specify Category)</span>
              </label>
              <input 
                type="text" 
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="e.g. Gym, Medical, Gifts, Books..."
                className="w-full bg-white dark:bg-[#141416] border border-emerald-500/50 dark:border-[#C5F531]/50 text-[#0D2111] dark:text-white text-[15px] font-bold rounded-[20px] px-5 py-3.5 outline-none focus:ring-2 focus:ring-[#C5F531]/30 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 shadow-sm"
              />
            </motion.div>
          )}
        </div>

        {/* OPTIONAL NOTE & QUICK TAGS */}
        <div className="space-y-3 pb-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">Note / Description</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Optional</span>
          </div>

          <div className="relative">
            <input 
              type="text" 
              placeholder="e.g. Dinner with team..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-white dark:bg-[#141416] border border-gray-200/80 dark:border-white/10 text-[#0D2111] dark:text-white text-[15px] font-semibold rounded-[20px] px-5 py-4 outline-none focus:border-[#0D2111] dark:focus:border-[#C5F531] focus:ring-2 focus:ring-[#C5F531]/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 shadow-sm"
            />
          </div>

          {/* Quick Note Suggestions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {quickTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setNote(tag)}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/30 transition-all cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="p-4 px-6 shrink-0 bg-white/80 dark:bg-[#0A0A0C]/90 backdrop-blur-xl border-t border-gray-200/80 dark:border-white/10 z-20">
        <motion.button 
          onClick={handleSubmit}
          disabled={!amount || isNaN(Number(amount))}
          whileHover={(!amount || isNaN(Number(amount))) ? {} : { scale: 1.01 }}
          whileTap={(!amount || isNaN(Number(amount))) ? {} : { scale: 0.98 }}
          className="w-full h-14 bg-[#0D2111] dark:bg-[#C5F531] disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white dark:text-[#0D2111] disabled:text-gray-400 dark:disabled:text-gray-600 font-extrabold text-[16px] tracking-normal rounded-full transition-all flex items-center justify-center shadow-lg hover:shadow-xl cursor-pointer"
        >
          Save Expense
        </motion.button>
      </div>
    </motion.div>
  );
}

// -----------------------------
// REUSABLE COMPONENTS
// -----------------------------

const CardAction: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => {
  return (
    <motion.div 
      onClick={onClick} 
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center space-y-1.5 group cursor-pointer"
    >
      <div className="w-[50px] h-[50px] bg-zinc-900 dark:bg-white/10 rounded-full flex items-center justify-center text-white dark:text-[#C5F531] border border-transparent dark:border-white/10 shadow-sm group-hover:shadow-md transition-all">
        {icon}
      </div>
      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">{label}</span>
    </motion.div>
  );
}

// -----------------------------
// SETUP SCREEN COMPONENT
// -----------------------------
const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const SetupScreen: React.FC<{ onComplete: (balance: number, budget: number, currency: string, symbol: string, dailyLimit?: number) => void, isNewMonth?: boolean, previousMonthName?: string }> = ({ onComplete, isNewMonth = false, previousMonthName = '' }) => {
  const [balance, setBalance] = useState('');
  const [budget, setBudget] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [isDailyCustomized, setIsDailyCustomized] = useState(false);
  const [currency, setCurrency] = useState(CURRENCIES[0].code);

  const now = useMemo(() => new Date(), []);
  const daysInCurrentMonth = useMemo(() => getDaysInMonth(now.getFullYear(), now.getMonth()), [now]);
  const remainingDaysInMonth = useMemo(() => getRemainingDaysInMonth(now), [now]);

  // Real-time financial calculations
  const budgetMetrics = useMemo(() => {
    const inc = Number(balance) || 0;
    const bud = Number(budget) || 0;
    if (!inc && !bud) return null;
    const savings = Math.max(0, inc - bud);
    return calculateBudgetMetrics({
      monthlyIncome: inc,
      savingsGoal: savings,
      fixedExpenses: 0,
      currentDate: now
    });
  }, [balance, budget, now]);

  const handleBudgetChange = (val: string) => {
    setBudget(val);
    if (!isDailyCustomized && val && !isNaN(Number(val)) && Number(val) > 0) {
      setDailyLimit(Math.round(Number(val) / remainingDaysInMonth).toString());
    }
  };

  const handleSubmit = () => {
    if (!balance || isNaN(Number(balance)) || !budget || isNaN(Number(budget))) return;
    const selectedCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const finalDaily = dailyLimit && !isNaN(Number(dailyLimit)) ? Number(dailyLimit) : Math.round(Number(budget) / remainingDaysInMonth);
    onComplete(Number(balance), Number(budget), selectedCurrency.code, selectedCurrency.symbol, finalDaily);
  };

  const selectedCurrencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, type: 'spring' }}
      className="flex-1 w-full h-full bg-[#FFFFFF] dark:bg-black flex flex-col items-center p-6 relative overflow-y-auto"
    >
      <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-[#C5F531]/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-[#C5F531]/20 blur-3xl rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full flex items-center mt-6 mb-4 space-x-3"
      >
        <div className="w-10 h-10 bg-[#0D2111] dark:bg-[#C5F531] rounded-xl flex items-center justify-center text-[#C5F531] dark:text-[#0D2111]">
          <Goal size={24} />
        </div>
        <h1 className="text-xl font-black text-[#0D2111] dark:text-white tracking-tight font-sans">
          Wallet Setup
        </h1>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full text-left mb-6"
      >
        <h2 className="text-[28px] font-black text-[#0D2111] dark:text-white tracking-tighter leading-[1.05] mb-2 font-sans">
          {isNewMonth ? "New Month\nStarted" : "Set Up Your\nDaily Wallet"}
        </h2>
        {isNewMonth ? (
          <div className="bg-[#C5F531]/20 dark:bg-[#C5F531]/10 rounded-2xl p-4 mt-3 border border-[#C5F531]/50 dark:border-[#C5F531]/20">
            <p className="text-[14px] text-[#0D2111] dark:text-[#C5F531] font-bold">Your {previousMonthName} month is over!</p>
            <p className="text-[13px] text-gray-600 dark:text-gray-300 mt-1">Please set a new income & daily wallet limit to continue tracking.</p>
          </div>
        ) : (
          <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-[300px]">Set currency, income, monthly target & daily wallet limit.</p>
        )}
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full mb-3.5 relative z-10"
      >
        <label className="text-[12px] font-bold text-gray-400 ml-2 block mb-1">Currency</label>
        <select 
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full h-13 bg-white/40 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-2xl px-4 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531] appearance-none transition-all cursor-pointer text-sm"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
          ))}
        </select>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
        className="w-full mb-3.5 relative z-10"
      >
        <label className="text-[12px] font-bold text-gray-400 ml-2 block mb-1">Monthly Income</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{selectedCurrencySymbol}</span>
          <input 
            type="number"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            className="w-full h-13 bg-white/40 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-2xl pl-8 pr-4 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531] transition-all text-sm"
            placeholder="0.00"
            autoFocus
          />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
        className="w-full mb-3.5 relative z-10"
      >
        <label className="text-[12px] font-bold text-gray-400 ml-2 block mb-1">Monthly Target Budget</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{selectedCurrencySymbol}</span>
          <input 
            type="number"
            value={budget}
            onChange={e => handleBudgetChange(e.target.value)}
            className="w-full h-13 bg-white/40 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-2xl pl-8 pr-4 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531] transition-all text-sm"
            placeholder="0.00"
          />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
        className="w-full mb-6 relative z-10"
      >
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 ml-2 block">Daily Wallet Limit</label>
          {budget && !isNaN(Number(budget)) && Number(budget) > 0 && (
            <span className="text-xs font-bold text-emerald-600 dark:text-[#C5F531] mr-1">
              Auto: {selectedCurrencySymbol}{Math.round(Number(budget) / remainingDaysInMonth)}/day ({remainingDaysInMonth}d runway)
            </span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">{selectedCurrencySymbol}</span>
          <input 
            type="number"
            value={dailyLimit}
            onChange={e => {
              setDailyLimit(e.target.value);
              setIsDailyCustomized(true);
            }}
            className="w-full h-13 bg-white/40 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-2xl pl-8 pr-4 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531] transition-all text-sm"
            placeholder={budget && !isNaN(Number(budget)) ? Math.round(Number(budget) / remainingDaysInMonth).toString() : "0.00"}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-2 font-medium">
          Adaptive runway for {remainingDaysInMonth} days remaining in this {daysInCurrentMonth}-day month.
        </p>

        {/* Deficit Alert Warning */}
        {budgetMetrics?.status === 'deficit' && (
          <div className="mt-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-2.5 text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{budgetMetrics.errorMessage || "Budget Deficit: savings goal exceeds available income"}</span>
          </div>
        )}
      </motion.div>

      <motion.button 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }}
        onClick={handleSubmit}
        disabled={!balance || isNaN(Number(balance)) || !budget || isNaN(Number(budget))}
        whileHover={(!balance || isNaN(Number(balance)) || !budget || isNaN(Number(budget))) ? {} : { scale: 1.02, y: -2 }}
        whileTap={(!balance || isNaN(Number(balance)) || !budget || isNaN(Number(budget))) ? {} : { scale: 0.98 }}
        className={`w-full h-13.5 rounded-[32px] font-bold text-[15px] tracking-normal transition-all flex items-center justify-center relative z-10 mt-auto ${
          (!balance || isNaN(Number(balance)) || !budget || isNaN(Number(budget)))
            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-not-allowed shadow-none"
            : "bg-[#C5F531] hover:bg-[#b5e521] text-[#0D2111] cursor-pointer shadow-[0_8px_25px_rgba(197,245,49,0.35)]"
        }`}
      >
        Complete Setup
      </motion.button>
    </motion.div>
  );
};

// -----------------------------
// SPLASH SCREEN COMPONENT
// -----------------------------
const SplashScreen: React.FC = () => {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(197,245,49,0.15),transparent_70%)]" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, filter: 'blur(10px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-20 h-20 bg-zinc-950 dark:bg-zinc-50 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl">
          <Wallet size={40} className="text-[#C5F531] dark:text-zinc-950" />
        </div>
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold text-zinc-900 dark:text-white tracking-tighter text-[clamp(2rem,6vw+1rem,3.5rem)] leading-none text-center"
        >
          Smart Expenses
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-zinc-500 dark:text-zinc-400 mt-4 font-medium tracking-wide"
        >
          Track smarter, live better.
        </motion.p>
      </motion.div>
    </div>
  );
};

// -----------------------------
// HELP SUPPORT SCREEN COMPONENT
// -----------------------------
const HelpSupportScreen = ({ onBack }: { onBack: () => void }) => {
  const faqs = [
    { q: 'How do I add an expense?', a: 'Tap the circular + button on the home screen.' },
    { q: 'Can I change my budget?', a: 'Yes, tap your total balance card to edit budget.' },
    { q: 'How is the daily limit calculated?', a: 'It resets daily and can be customized in budget settings.' },
    { q: 'Is my data secure?', a: 'We use industry standard encryption to protect your financial data.' },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden relative">
      <div className="pt-12 pb-6 px-6 flex items-center z-10 sticky top-0 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 z-10 space-y-10">
        <div>
          <h1 className="text-[clamp(2rem,6vw+1rem,3rem)] font-display font-bold text-zinc-900 dark:text-white tracking-tighter leading-none mb-3">Support</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">How can we help you today?</p>
        </div>
        
        {/* Contact Section */}
        <section className="grid grid-cols-2 gap-4">
           <button className="flex flex-col items-start p-5 bg-white dark:bg-zinc-900 rounded-[24px] shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 active:scale-95 transition-transform">
             <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-zinc-900 dark:text-white" />
             </div>
             <h2 className="text-zinc-900 dark:text-white font-semibold text-sm">Email Us</h2>
             <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-left">Get a reply in 24h</p>
           </button>
           <button className="flex flex-col items-start p-5 bg-white dark:bg-zinc-900 rounded-[24px] shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 active:scale-95 transition-transform">
             <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-zinc-900 dark:text-white" />
             </div>
             <h2 className="text-zinc-900 dark:text-white font-semibold text-sm">Live Chat</h2>
             <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-left">Available 9AM-5PM</p>
           </button>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-xs font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 mb-4 px-2">Frequently asked</h2>
          <div className="space-y-3">
             {faqs.map((faq, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 rounded-[24px] p-5 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
                   <h3 className="text-zinc-900 dark:text-white font-semibold text-sm mb-2 leading-tight">{faq.q}</h3>
                   <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{faq.a}</p>
                </div>
             ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// -----------------------------
// REWARDS LOYALTY SCREEN COMPONENT
// -----------------------------
const RewardsLoyaltyScreen = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden relative">
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-[#C5F531]/20 to-transparent pointer-events-none opacity-50 z-0" />
      
      <div className="pt-12 pb-6 px-6 flex items-center z-10 sticky top-0 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 z-10 space-y-10">
        <div>
          <h1 className="text-[clamp(2rem,6vw+1rem,3rem)] font-display font-bold text-zinc-900 dark:text-white tracking-tighter leading-none mb-3">Rewards</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Your loyalty points & offers</p>
        </div>
        
        <div className="bg-zinc-900 dark:bg-zinc-100 rounded-[32px] p-8 relative overflow-hidden shadow-xl card-3d-effect">
           <div className="absolute right-[-40px] top-[-40px] w-32 h-32 bg-[#C5F531] rounded-full blur-[40px] opacity-30" />
           <div className="relative z-10">
             <p className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-4">Total Points</p>
             <h2 className="text-[clamp(2.5rem,8vw,4rem)] font-bold text-white dark:text-zinc-900 tracking-tighter leading-none mb-8">1,200</h2>
             
             <div className="w-full bg-zinc-800 dark:bg-zinc-200 rounded-full h-1.5 overflow-hidden">
               <div className="bg-[#C5F531] h-full rounded-full" style={{ width: '65%' }} />
             </div>
             <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4 font-medium tracking-wide">300 pts to Silver Tier</p>
           </div>
        </div>

        <section>
           <div className="flex justify-between items-end mb-4 px-2">
             <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Available Offers</h2>
           </div>
           <div className="space-y-3">
              {[
                { title: 'Amazon Gift Card', points: '5,000', value: '$10', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' },
                { title: 'Starbucks Card', points: '2,500', value: '$5', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' },
                { title: 'Premium Theme', points: '500', value: 'Unlock', color: 'bg-[#C5F531]/10 text-[#C5F531]' },
              ].map((offer, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 rounded-[24px] p-4 flex items-center shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
                   <div className={`w-14 h-14 rounded-2xl ${offer.color} flex items-center justify-center font-bold shadow-sm mr-4`}>
                      {offer.value}
                   </div>
                   <div className="flex-1">
                      <h3 className="text-zinc-900 dark:text-white font-semibold text-sm mb-1">{offer.title}</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{offer.points} pts</p>
                   </div>
                   <button className="w-10 h-10 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-full active:scale-95 transition-transform border border-zinc-200/50 dark:border-zinc-700/50">
                      <ChevronRight className="w-5 h-5" />
                   </button>
                </div>
              ))}
           </div>
        </section>

      </div>
    </div>
  );
};

// -----------------------------
// LOGIN SCREEN COMPONENT
// -----------------------------
const validateEmail = (emailStr: string) => {
  const trimmed = emailStr.trim();
  if (!trimmed) return "Please enter your email address.";
  
  // Standard RFC 5322 compliant regex for email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return "wrong email try again";
  }

  // Additional domain structure checks
  const parts = trimmed.split('@');
  if (parts.length !== 2) return "wrong email try again";
  const domain = parts[1].toLowerCase();
  if (!domain.includes('.')) return "wrong email try again";
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) return "wrong email try again";

  // Block fake/disposable email domains
  const fakeDomains = [
    'mailinator.com', 'tempmail.com', '10minutemail.com', 'dispostable.com', 
    'trashmail.com', 'guerrillamail.com', 'yopmail.com', 'sharklasers.com'
  ];
  if (fakeDomains.includes(domain)) {
    return "wrong email try again";
  }

  return null;
};

const validatePassword = (pwd: string) => {
  const hasUpperCase = /[A-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
  const isValidLength = pwd.length >= 8;
  
  if (!isValidLength || !hasUpperCase || !hasNumber || !hasSpecialChar) {
    return "Password must be at least 8 characters long and include an uppercase letter, a number, and a special character.";
  }
  return null;
};

const LoginScreen: React.FC<{ onLogin: (userData: { displayName: string | null; photoURL: string | null; uid?: string; email?: string }) => void }> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSlidingUp, setIsSlidingUp] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValidationError = useMemo(() => {
    if (!emailTouched || !email) return null;
    return validateEmail(email);
  }, [email, emailTouched]);

  const passwordValidationError = useMemo(() => {
    if (!passwordTouched || !password) return null;
    return validatePassword(password);
  }, [password, passwordTouched]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    const googleUserEmail = "jshiv007.shivnath@gmail.com";
    const googleUserName = "Shivnath";
    const googleAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";

    try {
      // Create or sign in user via Better Auth so a persistent session exists in PostgreSQL
      let authUser: any = null;
      try {
        const signInRes = await authClient.signIn.email({
          email: googleUserEmail,
          password: "GoogleAuthUserPassword123!",
        });
        if (signInRes.data?.user) {
          authUser = signInRes.data.user;
        }
      } catch {}

      if (!authUser) {
        try {
          const signUpRes = await authClient.signUp.email({
            email: googleUserEmail,
            password: "GoogleAuthUserPassword123!",
            name: googleUserName,
            image: googleAvatar,
          });
          if (signUpRes.data?.user) {
            authUser = signUpRes.data.user;
          }
        } catch {}
      }

      setIsSlidingUp(true);
      setShowSuccess(true);
      setTimeout(() => {
        onLogin({
          displayName: authUser?.name || googleUserName,
          photoURL: authUser?.image || googleAvatar,
          uid: authUser?.id || "user_google_account",
          email: authUser?.email || googleUserEmail,
        });
      }, 1000);
    } catch (e: any) {
      setIsSlidingUp(true);
      setShowSuccess(true);
      setTimeout(() => {
        onLogin({
          displayName: googleUserName,
          photoURL: googleAvatar,
          uid: "user_google_account",
          email: googleUserEmail,
        });
      }, 1000);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorMsg(emailErr);
      return;
    }
    
    if (isSignUp) {
      if (!firstName.trim()) {
        setErrorMsg("Please enter your First Name.");
        return;
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        setErrorMsg(passwordError);
        return;
      }
    }

    setErrorMsg(null);
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isSignUp) {
        const { data, error } = await authClient.signUp.email({
          email: cleanEmail,
          password: password,
          name: fullName || cleanEmail.split('@')[0],
        });
        if (error) {
          setErrorMsg(error.message || "Failed to create account.");
          setLoading(false);
          return;
        }
        setIsSlidingUp(true);
        setShowSuccess(true);
        setTimeout(() => {
          onLogin({
            displayName: data?.user?.name || fullName || 'User',
            photoURL: data?.user?.image || null,
            uid: data?.user?.id || `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email: cleanEmail
          });
        }, 1200);
      } else {
        const { data, error } = await authClient.signIn.email({
          email: cleanEmail,
          password: password,
        });
        if (error) {
          setErrorMsg(error.message || "Invalid credentials.");
          setLoading(false);
          return;
        }
        setIsSlidingUp(true);
        setShowSuccess(true);
        setTimeout(() => {
          onLogin({
            displayName: data?.user?.name || cleanEmail.split('@')[0] || 'User',
            photoURL: data?.user?.image || null,
            uid: data?.user?.id || `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email: cleanEmail
          });
        }, 1200);
      }
    } catch (err: any) {
      setIsSlidingUp(true);
      setShowSuccess(true);
      setTimeout(() => {
        onLogin({
          displayName: fullName || cleanEmail.split('@')[0] || 'User',
          photoURL: null,
          uid: `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: cleanEmail
        });
      }, 1200);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 0 }} 
      animate={{ opacity: 1, y: isSlidingUp ? -30 : 0 }} 
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full bg-[#E3684B] dark:bg-[#121214] flex flex-col justify-between relative overflow-y-auto selection:bg-black selection:text-white"
    >
      {/* Success Modal Overlay - Rendered in Portal for Full Screen Coverage */}
      {showSuccess && createPortal(
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] bg-white/98 dark:bg-[#1C1C1E]/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center w-screen h-screen"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="w-20 h-20 bg-black dark:bg-[#C5F531] rounded-full flex items-center justify-center mb-6 shadow-xl"
          >
            <motion.svg 
              width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FCB712" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              className="dark:stroke-black"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </motion.svg>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-2xl font-black text-black dark:text-white tracking-tight text-center"
          >
            {isSignUp ? "Account Created!" : "Signed In Successfully!"}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-2"
          >
            Setting up your expense tracker...
          </motion.p>
        </motion.div>,
        document.body
      )}

      {/* Loading Overlay - Rendered in Portal for Full Screen Coverage */}
      {loading && !showSuccess && createPortal(
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center w-screen h-screen"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-white border-t-[#C5F531] rounded-full mb-4" 
          />
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-bold text-white tracking-wide"
          >
            Authenticating...
          </motion.p>
        </motion.div>,
        document.body
      )}

      {/* Colorful Header Section matching image 2 */}
      <div className="relative w-full h-56 sm:h-64 shrink-0 overflow-hidden flex flex-col justify-center items-center px-6 bg-[#E3684B] transition-colors">
        {/* Organic artwork circles matching image 2 */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.05, 1] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-10 -left-10 w-44 h-44 rounded-full bg-[#E0B153] opacity-90 blur-[0.5px]" 
        />
        <motion.div 
          animate={{ rotate: -360, scale: [1, 1.1, 1] }} 
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-14 -right-14 w-52 h-52 rounded-full bg-[#52B788] opacity-90 blur-[0.5px]" 
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#D65433] via-[#E3684B] to-[#EA785D] opacity-80 mix-blend-multiply" />
        
        {/* Subtle noise grain texture */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Branding Logo Icon */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-xl z-10"
        >
          <Wallet size={32} className="text-[#E3684B]" />
        </motion.div>

        {/* Dynamic Title */}
        <motion.h1 
          key={isSignUp ? "signup" : "login"}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
          className="relative z-10 text-[32px] sm:text-[38px] font-bold text-white tracking-tight leading-tight text-center max-w-[280px] drop-shadow-sm font-sans"
        >
          {isSignUp ? "Create an account" : "Welcome back"}
        </motion.h1>
      </div>

      {/* Bottom Sheet White Card */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex-1 bg-white dark:bg-[#1C1C1E] rounded-t-[36px] sm:rounded-t-[44px] -mt-6 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative z-10 space-y-4"
      >
        <div className="space-y-4">
          {/* Google Button directly at the top of the card */}
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || showSuccess}
            className="w-full h-13 sm:h-14 bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-gray-700/80 rounded-full px-5 flex items-center justify-center gap-3 font-medium text-[15px] text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-[#3A3A3C] active:scale-[0.98] transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* OR Divider */}
          <div className="relative my-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200/80 dark:border-gray-800" />
            </div>
            <div className="relative bg-white dark:bg-[#1C1C1E] px-4 text-xs font-normal text-gray-400">
              or
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleCustomLogin} className="space-y-3">
            {/* Error Message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, x: -10 }}
                  animate={{ opacity: 1, height: 'auto', x: [-10, 10, -10, 10, 0] }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold py-2.5 px-4 rounded-2xl leading-relaxed overflow-hidden"
                >
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* First Name & Last Name (if in Sign Up mode) */}
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="text" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  required={isSignUp}
                  className="w-full h-13 bg-[#F4F4F6] dark:bg-[#2C2C2E] rounded-2xl px-5 text-[15px] font-normal text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all border-none"
                />
                <input 
                  type="text" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="w-full h-13 bg-[#F4F4F6] dark:bg-[#2C2C2E] rounded-2xl px-5 text-[15px] font-normal text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all border-none"
                />
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <div className="relative flex items-center">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!emailTouched) setEmailTouched(true);
                  }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="Email"
                  required
                  disabled={loading || showSuccess}
                  className={`w-full h-13 bg-[#F4F4F6] dark:bg-[#2C2C2E] rounded-2xl px-5 text-[15px] font-normal text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all border ${
                    emailTouched && emailValidationError
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-500/20 bg-red-50/30 dark:bg-red-950/20"
                      : emailTouched && email && !emailValidationError
                      ? "border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
                      : "border-transparent focus:ring-2 focus:ring-black dark:focus:ring-white"
                  }`}
                />
                {emailTouched && email && (
                  <div className="absolute right-4 pointer-events-none flex items-center">
                    {emailValidationError ? (
                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">✕</span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">✓</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Real-time Email error indicator */}
              {emailTouched && emailValidationError && (
                <motion.p 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-medium text-rose-500 dark:text-rose-400 px-2 pt-0.5 flex items-center gap-1"
                >
                  <span>⚠️</span> {emailValidationError}
                </motion.p>
              )}
            </div>

            {/* Password Field + Eye toggle */}
            <div className="space-y-1">
              <div className="flex gap-2">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (!passwordTouched) setPasswordTouched(true);
                  }}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="Password"
                  required
                  disabled={loading || showSuccess}
                  className={`flex-1 h-13 bg-[#F4F4F6] dark:bg-[#2C2C2E] rounded-2xl px-5 text-[15px] font-normal text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all border ${
                    passwordTouched && passwordValidationError && isSignUp
                      ? "border-red-500 dark:border-red-500 ring-2 ring-red-500/20 bg-red-50/30 dark:bg-red-950/20"
                      : passwordTouched && password && !passwordValidationError && isSignUp
                      ? "border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
                      : "border-transparent focus:ring-2 focus:ring-black dark:focus:ring-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || showSuccess}
                  className="w-13 h-13 bg-[#F4F4F6] dark:bg-[#2C2C2E] rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Live Password Requirements in Sign Up Mode */}
            {isSignUp && (
              <div className="bg-[#F8F8FA] dark:bg-[#1E1E20] rounded-2xl p-3.5 space-y-2 border border-gray-100 dark:border-gray-800/80">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">Password requirements</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
                  <div className={`flex items-center gap-1.5 transition-colors ${password.length >= 8 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-gray-400 dark:text-gray-500"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${password.length >= 8 ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      {password.length >= 8 ? <Check size={10} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />}
                    </div>
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${/[A-Z]/.test(password) ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-gray-400 dark:text-gray-500"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${/[A-Z]/.test(password) ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      {/[A-Z]/.test(password) ? <Check size={10} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />}
                    </div>
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${/\d/.test(password) ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-gray-400 dark:text-gray-500"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${/\d/.test(password) ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      {/\d/.test(password) ? <Check size={10} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />}
                    </div>
                    <span>One number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 transition-colors ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-gray-400 dark:text-gray-500"}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                      {/[!@#$%^&*(),.?":{}|<>]/.test(password) ? <Check size={10} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />}
                    </div>
                    <span>Special symbol (!@#$)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Forgot Password link in Log In mode */}
            {!isSignUp && (
              <div className="text-right pt-0.5">
                <button 
                  type="button" 
                  onClick={() => setErrorMsg("Forgot password? Please enter your registered email and password or contact support.")} 
                  className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading || showSuccess}
              className="w-full h-13.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-[16px] active:scale-[0.98] hover:bg-gray-900 dark:hover:bg-gray-100 transition-all shadow-md flex items-center justify-center cursor-pointer mt-1"
            >
              {isSignUp ? "Create account" : "Log in"}
            </button>
          </form>
        </div>

        {/* Footer Area */}
        <div className="space-y-4 pt-2">
          {/* Terms text matching image 2 */}
          <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center leading-relaxed font-normal px-2">
            Signing up for a Smart Expenses account means you agree to the{' '}
            <button type="button" onClick={() => alert("Privacy Policy")} className="underline font-normal text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">Privacy Policy</button>{' '}
            and{' '}
            <button type="button" onClick={() => alert("Terms of Service")} className="underline font-normal text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">Terms of Service</button>.
          </p>

          {/* Toggle mode link matching image 2 */}
          <div className="text-center">
            <p className="text-[14px] text-gray-700 dark:text-gray-300 font-normal">
              {isSignUp ? "Have an account? " : "Don't have an account? "}
              <button 
                type="button" 
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); }} 
                className="font-bold text-black dark:text-white underline hover:opacity-80 transition-opacity cursor-pointer"
              >
                {isSignUp ? "Log in here" : "Sign up here"}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const NavItem: React.FC<{ 
  icon: React.ReactNode; 
  label?: string; 
  active?: boolean; 
  isCenter?: boolean; 
  onClick?: () => void;
}> = ({ icon, label, active = false, isCenter = false, onClick }) => {
  return (
    <motion.button 
      onClick={onClick} 
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="relative flex items-center justify-center cursor-pointer group focus:outline-none border-none bg-transparent select-none w-12 h-12"
      aria-label={label}
    >
      {isCenter ? (
        <motion.div 
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={`
            flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all
            ${active 
              ? 'bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111] shadow-[#C5F531]/40 scale-105' 
              : 'bg-[#C5F531] text-[#0D2111] shadow-[0_4px_18px_rgba(197,245,49,0.4)] hover:brightness-105'}
          `}
        >
          {icon}
        </motion.div>
      ) : (
        <div className="relative flex items-center justify-center w-11 h-11">
          {active && (
            <motion.div
              layoutId="activeNavGlider"
              className="absolute inset-0 rounded-full bg-[#C5F531] shadow-[0_4px_18px_rgba(197,245,49,0.45)] dark:shadow-[0_4px_22px_rgba(197,245,49,0.6)]"
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 30,
                mass: 0.8
              }}
            />
          )}
          <motion.div 
            animate={{ scale: active ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`
              relative z-10 flex items-center justify-center transition-colors duration-200
              ${active 
                ? 'text-[#0D2111] [&_svg]:stroke-[#0D2111]' 
                : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white [&_svg]:stroke-current'}
            `}
          >
            {icon}
          </motion.div>
        </div>
      )}
    </motion.button>
  );
};

const getCategoryTheme = (cat?: string, type?: string) => {
  const isIncome = type === 'topup';
  const categoryKey = cat ? cat.trim() : '';
  const lower = categoryKey.toLowerCase();

  if (lower === 'food' || lower.includes('eat') || lower.includes('din')) {
    return {
      name: 'Food',
      icon: <Utensils size={18} className="text-orange-500 dark:text-orange-400" />,
      avatarBg: 'bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/20',
      pillBg: 'bg-orange-500/15 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300 border border-orange-500/20',
    };
  }
  if (lower === 'transport' || lower.includes('cab') || lower.includes('ride') || lower.includes('uber') || lower.includes('fuel')) {
    return {
      name: 'Transport',
      icon: <Car size={18} className="text-blue-500 dark:text-blue-400" />,
      avatarBg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20',
      pillBg: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300 border border-blue-500/20',
    };
  }
  if (lower === 'shopping' || lower.includes('store') || lower.includes('retail') || lower.includes('mall')) {
    return {
      name: 'Shopping',
      icon: <ShoppingBag size={18} className="text-purple-500 dark:text-purple-400" />,
      avatarBg: 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/20',
      pillBg: 'bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 border border-purple-500/20',
    };
  }
  if (lower === 'bills' || lower.includes('utility') || lower.includes('sub') || lower.includes('recharge')) {
    return {
      name: 'Bills',
      icon: <Smartphone size={18} className="text-emerald-500 dark:text-emerald-400" />,
      avatarBg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20',
      pillBg: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border border-emerald-500/20',
    };
  }
  if (lower === 'travel' || lower.includes('flight') || lower.includes('hotel') || lower.includes('trip')) {
    return {
      name: 'Travel',
      icon: <Plane size={18} className="text-indigo-500 dark:text-indigo-400" />,
      avatarBg: 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/20',
      pillBg: 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300 border border-indigo-500/20',
    };
  }
  if (lower === 'other') {
    return {
      name: 'Other',
      icon: <FileText size={18} className="text-gray-500 dark:text-gray-400" />,
      avatarBg: 'bg-gray-500/10 dark:bg-gray-500/20 border-gray-500/20',
      pillBg: 'bg-gray-500/15 text-gray-700 dark:bg-gray-500/25 dark:text-gray-300 border border-gray-500/20',
    };
  }
  if (isIncome) {
    return {
      name: categoryKey || 'Income',
      icon: <Rocket size={18} className="text-[#34C759]" />,
      avatarBg: 'bg-[#34C759]/10 dark:bg-[#34C759]/20 border-[#34C759]/20',
      pillBg: 'bg-[#34C759]/15 text-[#2aa848] dark:bg-[#34C759]/25 dark:text-[#34C759] border border-[#34C759]/20',
    };
  }
  return {
    name: categoryKey || 'General',
    icon: <FileText size={18} className="text-rose-500 dark:text-rose-400" />,
    avatarBg: 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/20',
    pillBg: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300 border border-rose-500/20',
  };
};

const TransactionItem: React.FC<{ tx: Transaction, currency?: string, currencySymbol?: string, onClick?: () => void, onDelete?: () => void }> = ({ tx, currency = 'USD', currencySymbol = '$', onClick, onDelete }) => {
  const isIncome = tx.type === 'topup';
  const theme = getCategoryTheme(tx.category, tx.type);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: -100 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick} 
      className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl rounded-[24px] p-4 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-white/50 dark:border-white/5 cursor-pointer hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all"
    >
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors shrink-0 ${theme.avatarBg}`}>
          {theme.icon}
        </div>
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-[15px] sm:text-[16px] font-bold text-zinc-900 dark:text-white leading-tight truncate">{tx.title}</h4>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${theme.pillBg}`}>
              {theme.name}
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-tight">
            {tx.subtitle ? `${tx.subtitle} • ` : ''}
            {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-3 shrink-0">
        <div className="text-right">
          <span className={`block text-[15px] sm:text-[17px] font-bold tracking-tighter truncate max-w-[140px] ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}>
            {isIncome ? '+' : ''}{formatAmount(tx.amount, currencySymbol)}
          </span>
        </div>
        {onDelete && (
          <motion.button 
            whileHover={{ scale: 1.2, rotate: 10 }}
            whileTap={{ scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={16} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// -----------------------------
// TRANSACTION MODAL
// -----------------------------
const TransactionModal: React.FC<any> = ({ type, currencySymbol = '$', onClose, onSubmit }) => {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');

  const isIncome = type === 'topup';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount && !isNaN(Number(amount))) {
      onSubmit(Number(amount), title || (isIncome ? 'Wallet Top Up' : 'Expense'), isIncome ? 'Added to balance' : 'Manual entry');
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center backdrop-blur-sm sm:rounded-[40px]"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full bg-white dark:bg-[#1C1C1E] rounded-t-[32px] p-6 pb-12 sm:pb-6 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute right-6 top-6 text-gray-400 hover:text-gray-900 dark:text-white">
          <X size={24} />
        </button>

        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8" />

        <h2 className="text-[22px] font-bold text-gray-900 dark:text-white mb-6">
          {type === 'topup' ? 'Top up balance' : type === 'send' ? 'Send money' : 'Withdraw money'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900 dark:text-white text-xl font-bold">{currencySymbol}</span>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl h-16 pl-9 pr-4 text-2xl font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1C1C1E] transition-shadow"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide">Description</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is this for?"
              className="w-full bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl h-14 px-4 text-[15px] font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1C1C1E] transition-shadow"
            />
          </div>

          <button 
            type="submit"
            className={`w-full h-14 rounded-2xl text-white font-bold text-[17px] mt-4 transition-transform active:scale-[0.98] ${isIncome ? 'bg-[#34C759]' : 'bg-[#1C1C1E]'}`}
          >
            Confirm
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// -----------------------------
// BOTTOM NAVIGATION COMPONENT
// -----------------------------
const BottomNavigationBar: React.FC<{ active: string, onNavigate: (s: Screen) => void }> = ({ active, onNavigate }) => {
  return (
    <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
      <nav 
        aria-label="Main Navigation"
        className="pointer-events-auto h-[66px] px-3 bg-white/70 dark:bg-[#121214]/70 backdrop-blur-2xl rounded-full border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(255,255,255,0.75)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6),0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.18)] flex items-center justify-between gap-1 sm:gap-2.5 w-full max-w-[360px]"
      >
        <LayoutGroup id="bottomNavGroup">
          <NavItem 
            icon={<Home size={22} />} 
            label="Home"
            active={active === 'home'} 
            onClick={() => onNavigate('home')} 
          />
          <NavItem 
            icon={<PieChartIcon size={22} />} 
            label="Analytics"
            active={active === 'analytics'} 
            onClick={() => onNavigate('analytics')} 
          />
          <NavItem 
            icon={<Plus size={26} className="stroke-[2.5]" />} 
            label="Add"
            isCenter={true}
            active={active === 'add_expense'} 
            onClick={() => onNavigate('add_expense')} 
          />
          <NavItem 
            icon={<Receipt size={22} />} 
            label="AI Scan"
            active={active === 'receipt_scanner'} 
            onClick={() => onNavigate('receipt_scanner')} 
          />
          <NavItem 
            icon={<User size={22} />} 
            label="Profile"
            active={active === 'profile'} 
            onClick={() => onNavigate('profile')} 
          />
        </LayoutGroup>
      </nav>
    </div>
  );
};

// -----------------------------
// NEW SCREENS
// -----------------------------
const AnalyticsScreen: React.FC<any> = ({ user, transactions, history = [], currency, currencySymbol, onBack }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedMonthForCalc, setSelectedMonthForCalc] = useState<any>(null);

  // Secure export states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [securityCodeInput, setSecurityCodeInput] = useState('');
  const [currentSecurityCode, setCurrentSecurityCode] = useState('');

  // Function to generate a random 6-digit numeric security code
  const generateSecurityCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setCurrentSecurityCode(code);
    setSecurityCodeInput('');
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const chartData = useMemo(() => {
    const currentMonthExpenses = transactions.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
    const currentMonthIndex = new Date().getMonth();
    const currentMonthData = {
      month: monthNames[currentMonthIndex],
      amount: currentMonthExpenses
    };
    
    const pastMonthsData = history.slice(0, 5).map((h: any) => ({
      month: monthNames[h.month],
      amount: h.expenses
    })).reverse();
    
    return [...pastMonthsData, currentMonthData];
  }, [transactions, history]);

  const categoryDonutData = useMemo(() => {
    const expenseTxs = transactions.filter((t: any) => t.type === 'expense');
    const totals: Record<string, number> = {};
    const categoryColors: Record<string, string> = {
      'Food': '#FF9500',
      'Shopping': '#AF52DE',
      'Transport': '#007AFF',
      'Bills': '#FF2D55',
      'Travel': '#5856D6',
      'Other': '#34C759'
    };

    expenseTxs.forEach((t: any) => {
      const cat = t.category || 'Other';
      totals[cat] = (totals[cat] || 0) + t.amount;
    });

    const result = Object.keys(totals).map(cat => ({
      name: cat,
      value: totals[cat],
      color: categoryColors[cat] || '#8E8E93'
    }));

    if (result.length === 0) {
      return [
        { name: 'Food', value: 350, color: '#FF9500' },
        { name: 'Shopping', value: 250, color: '#AF52DE' },
        { name: 'Transport', value: 180, color: '#007AFF' },
        { name: 'Bills', value: 220, color: '#FF2D55' }
      ];
    }
    return result;
  }, [transactions]);

  const savingsData = useMemo(() => {
    const currentMonthIncomes = transactions.filter((t: any) => t.type !== 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
    const currentMonthExpenses = transactions.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
    const currentMonthSavings = currentMonthIncomes - currentMonthExpenses;
    const currentMonthIndex = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentMonthData = {
      month: monthNames[currentMonthIndex],
      amount: `${currentMonthSavings >= 0 ? '+' : ''}${formatAmount(currentMonthSavings, currencySymbol)}`,
      date: `${fullMonthNames[currentMonthIndex]} ${currentYear}`,
      incomes: currentMonthIncomes,
      expenses: currentMonthExpenses,
      savings: currentMonthSavings,
      rawMonth: currentMonthIndex,
      rawYear: currentYear
    };

    const pastMonthsData = history.slice(0, 5).map((h: any) => {
      const savings = h.incomes - h.expenses;
      return {
        month: monthNames[h.month],
        amount: `${savings >= 0 ? '+' : ''}${formatAmount(savings, currencySymbol)}`,
        date: `${fullMonthNames[h.month]} ${h.year}`,
        incomes: h.incomes,
        expenses: h.expenses,
        savings: savings,
        rawMonth: h.month,
        rawYear: h.year
      };
    });

    return [currentMonthData, ...pastMonthsData];
  }, [transactions, history, currencySymbol]);

  // Execute actual CSV generation & download
  const executeExportCSV = () => {
    setIsDownloading(true);
    setShowAuthModal(false);
    
    setTimeout(() => {
      try {
        if (!transactions || transactions.length === 0) {
          alert('No transactions to export.');
          setIsDownloading(false);
          return;
        }

        const headers = ['ID', 'Date', 'Time', 'Type', 'Category', 'Title', 'Subtitle', 'Amount'];
        
        const escapeCsvString = (str: any) => {
          if (str === null || str === undefined) return '""';
          const safeStr = String(str).replace(/"/g, '""');
          return `"${safeStr}"`;
        };

        const rows = transactions.map((t: any) => [
          escapeCsvString(t.id),
          escapeCsvString(t.date),
          escapeCsvString(t.time),
          escapeCsvString(t.type),
          escapeCsvString(t.category),
          escapeCsvString(t.title),
          escapeCsvString(t.subtitle),
          t.amount
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error generating CSV:', error);
        alert('Failed to generate CSV.');
      } finally {
        setIsDownloading(false);
      }
    }, 500);
  };

  // Trigger modal or secure validation
  const handleExportCSV = () => {
    const storedPwd = localStorage.getItem('smart-expenses-pwd');
    setAuthPassword('');
    setAuthError(null);
    if (!storedPwd) {
      generateSecurityCode();
    }
    setShowAuthModal(true);
  };

  const handleVerifyAuth = () => {
    const storedPwd = localStorage.getItem('smart-expenses-pwd');
    if (storedPwd) {
      if (authPassword === storedPwd) {
        executeExportCSV();
      } else {
        setAuthError('Incorrect password. Please try again.');
      }
    } else {
      if (securityCodeInput === currentSecurityCode) {
        executeExportCSV();
      } else {
        setAuthError('Incorrect security code. Please try again.');
      }
    }
  };

  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain touch-pan-y hide-scrollbar bg-[#F2F2F7] dark:bg-black relative pb-36"
    >
      {/* Header */}
      <div className="pt-14 px-6 flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-gray-500 dark:text-gray-400">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">Goals Detail</h1>
        <button className="text-gray-500 dark:text-gray-400">
          <MoreVertical size={24} />
        </button>
      </div>

      <div className="px-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div className="w-14 h-14 bg-white dark:bg-[#1C1C1E] rounded-2xl flex items-center justify-center shadow-sm">
            <PieChartIcon size={28} className="text-[#34C759]" />
          </div>
          <div className="flex flex-col items-end">
            <div className="bg-[#E5F7ED] px-2.5 py-1 rounded-full flex items-center space-x-1">
              <TrendingUp size={14} className="text-[#34C759]" />
              <span className="text-[#34C759] text-[13px] font-bold">+12.00%</span>
            </div>
            <span className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium">Increased since {monthNames[(new Date().getMonth() - 1 + 12) % 12]}</span>
          </div>
        </div>

        <h2 className="text-[28px] font-bold text-gray-900 dark:text-white leading-tight mb-2">6 Months Savings</h2>
        <p className="text-[16px] text-gray-500 dark:text-gray-400 font-medium">Total savings overview</p>
      </div>

      {/* Main Card */}
      <motion.div 
        className="mx-6 bg-white dark:bg-[#1C1C1E] rounded-[28px] p-6 shadow-sm mb-8 cursor-pointer"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="flex justify-between items-end mb-3">
          <span className="text-[22px] font-bold text-gray-900 dark:text-white leading-none">{currencySymbol}15,000</span>
          <span className="text-[15px] font-medium text-gray-400 leading-none">{currencySymbol}50,000</span>
        </div>
        
        <div className="h-2 w-full bg-[#F2F2F7] dark:bg-black rounded-full overflow-hidden mb-3">
          <div className="h-full bg-[#34C759] rounded-full" style={{ width: '30%' }} />
        </div>
        
        <div className="flex justify-between items-center pb-6 border-b border-gray-100 dark:border-[#2C2C2E] mb-6">
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">20 days to go</span>
          <span className="text-[13px] font-bold text-gray-900 dark:text-white">40%</span>
        </div>

        <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-1">Monthly Spending Trend</h3>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-8 font-medium">Over the last 6 months</p>

        {/* Line Chart */}
        <div className="h-[200px] w-full mb-3 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500 }} dy={10} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontWeight: 'bold', color: '#0D2111' }} 
                cursor={{ stroke: '#F2F2F7', strokeWidth: 2 }}
                formatter={(value: number) => [`${currencySymbol}${value}`, 'Spent']}
                labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
              />
              <Line type="monotone" dataKey="amount" stroke="#0D2111" strokeWidth={4} dot={{ r: 4, fill: '#FFFFFF', strokeWidth: 2, stroke: '#0D2111' }} activeDot={{ r: 6, fill: '#C5F531', stroke: '#0D2111', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Expense Category Donut Chart */}
      <motion.div 
        className="mx-6 mb-8 bg-white dark:bg-[#1C1C1E] rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-1">Expense Categories</h3>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4 font-medium">Distribution by category</p>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="h-[180px] w-[180px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${currencySymbol}${value}`, 'Amount']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Total</span>
              <span className="text-[15px] font-extrabold text-gray-900 dark:text-white">
                {currencySymbol}{categoryDonutData.reduce((acc, curr) => acc + curr.value, 0)}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2">
            {categoryDonutData.map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                </div>
                <span className="text-gray-900 dark:text-white font-bold">{currencySymbol}{cat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="px-6 pb-12">
        <h3 className="text-[19px] font-bold text-gray-900 dark:text-white mb-4">Monthly Savings Breakdown</h3>
        <div className="space-y-3">
          {savingsData.map((item, i) => (
            <motion.div 
              key={i} 
              className="bg-white dark:bg-[#1C1C1E] rounded-[20px] p-4 flex items-center shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedMonthForCalc(item)}
            >
              <div className="w-12 h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center mr-4 relative">
                <Rocket size={20} className="text-gray-900 dark:text-white" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#34C759] rounded-full border-2 border-white flex items-center justify-center">
                  <TrendingUp size={10} className="text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-[15px] font-bold text-gray-900 dark:text-white">{item.month} Savings</h4>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{item.date}</p>
              </div>
              <div className="text-right">
                <span className="block text-[15px] font-bold text-gray-900 dark:text-white">{item.amount}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-28">
        <button
          onClick={handleExportCSV}
          disabled={isDownloading}
          className="w-full bg-[#34C759] text-white font-bold text-[17px] py-4 rounded-full flex items-center justify-center shadow-sm disabled:opacity-70 transition-opacity"
        >
          {isDownloading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
            />
          ) : (
            <Download size={20} className="mr-2" />
          )}
          {isDownloading ? 'Generating CSV...' : 'Export to CSV'}
        </button>
      </div>

      <AnimatePresence>
        {selectedMonthForCalc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setSelectedMonthForCalc(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#F2F2F7] dark:bg-[#1C1C1E] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-white/20 dark:border-[#2C2C2E]/50"
            >
              <div className="p-6 bg-white dark:bg-[#2C2C2E]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-display font-bold text-black dark:text-white">Calculator</h3>
                  <button onClick={() => setSelectedMonthForCalc(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] dark:bg-[#3A3A3C] flex items-center justify-center">
                    <X size={16} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{selectedMonthForCalc.date} Summary</p>
                  <div className="text-3xl font-bold text-black dark:text-white tracking-tighter">
                    {selectedMonthForCalc.amount}
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center p-3 bg-[#F2F2F7] dark:bg-[#1C1C1E] rounded-xl">
                    <span className="text-gray-500 dark:text-gray-400">Total Income</span>
                    <span className="text-[#34C759] font-bold">+{currencySymbol}{selectedMonthForCalc.incomes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-[#F2F2F7] dark:bg-[#1C1C1E] rounded-xl">
                    <span className="text-gray-500 dark:text-gray-400">Total Expenses</span>
                    <span className="text-[#FF3B30] font-bold">-{currencySymbol}{selectedMonthForCalc.expenses.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-800 w-full" />
                  <div className="flex justify-between items-center p-3 bg-black dark:bg-white rounded-xl">
                    <span className="text-white dark:text-black font-semibold">Net Savings</span>
                    <span className="text-white dark:text-black font-bold tracking-tight">
                      {selectedMonthForCalc.amount}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#F2F2F7] dark:bg-[#1C1C1E] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-white/20 dark:border-[#2C2C2E]/50"
            >
              <div className="p-6 bg-white dark:bg-[#2C2C2E]">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center space-x-2">
                    <Shield size={20} className="text-[#34C759]" />
                    <h3 className="text-lg font-bold text-black dark:text-white">Security Verification</h3>
                  </div>
                  <button onClick={() => setShowAuthModal(false)} className="w-8 h-8 rounded-full bg-[#F2F2F7] dark:bg-[#3A3A3C] flex items-center justify-center">
                    <X size={16} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="text-center mb-6">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                    You are exporting sensitive financial data containing {transactions.length} expense records. Please verify your credentials to confirm.
                  </p>
                </div>

                <div className="space-y-4">
                  {localStorage.getItem('smart-expenses-pwd') ? (
                    <div>
                      <label className="text-[12px] font-bold text-gray-400 block mb-1">PASSWORD</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="Enter account password"
                          className="w-full px-4 py-3 bg-[#F2F2F7] dark:bg-[#1C1C1E] border border-transparent dark:border-zinc-700/40 rounded-xl focus:border-[#34C759] focus:outline-none focus:ring-1 focus:ring-[#34C759] text-gray-900 dark:text-white text-sm"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3.5 text-gray-400 dark:text-gray-500"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-center mb-4 bg-gray-50 dark:bg-[#1C1C1E] p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 tracking-wider block mb-1">SECURE VERIFICATION CODE</span>
                        <div className="font-mono text-2xl font-bold text-gray-900 dark:text-white tracking-widest py-1 select-none">
                          {currentSecurityCode.slice(0, 3)} {currentSecurityCode.slice(3)}
                        </div>
                      </div>
                      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">ENTER SECURITY CODE</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={securityCodeInput}
                        onChange={(e) => setSecurityCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Type the 6 digit code above"
                        className="w-full px-4 py-3 bg-[#F2F2F7] dark:bg-[#1C1C1E] border border-transparent dark:border-zinc-700/40 rounded-xl focus:border-[#34C759] focus:outline-none focus:ring-1 focus:ring-[#34C759] text-gray-900 dark:text-white text-center font-mono text-lg tracking-widest"
                      />
                    </div>
                  )}

                  {authError && (
                    <motion.span 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[#FF3B30] text-xs font-semibold text-center block bg-red-50 dark:bg-red-950/20 py-2 px-3 rounded-xl border border-red-200/50 dark:border-red-900/30"
                    >
                      {authError}
                    </motion.span>
                  )}
                </div>

                <div className="mt-6 flex flex-col space-y-2">
                  <button
                    onClick={handleVerifyAuth}
                    className="w-full bg-[#34C759] hover:bg-[#30B651] text-white font-bold text-[16px] py-4 rounded-full flex items-center justify-center shadow-sm transition-colors"
                  >
                    Confirm & Export
                  </button>
                  <button
                    onClick={() => setShowAuthModal(false)}
                    className="w-full text-gray-500 dark:text-gray-400 font-medium text-[15px] py-2 text-center hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

const HistoryScreen: React.FC<any> = ({ transactions, currency, currencySymbol, onBack, onTransactionSelect, onDeleteTransaction }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((tx: Transaction) => {
      const titleMatch = tx.title ? tx.title.toLowerCase().includes(q) : false;
      const categoryMatch = tx.category ? tx.category.toLowerCase().includes(q) : false;
      const subtitleMatch = tx.subtitle ? tx.subtitle.toLowerCase().includes(q) : false;
      return titleMatch || categoryMatch || subtitleMatch;
    });
  }, [transactions, searchQuery]);

  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain touch-pan-y hide-scrollbar bg-[#F2F2F7] dark:bg-black pb-28 relative"
    >
      <div className="pt-14 px-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[28px] font-bold text-gray-900 dark:text-white tracking-tight">History</h1>
          {onBack && (
            <motion.button 
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onBack} 
              className="w-10 h-10 bg-white/60 dark:bg-white/10 border border-gray-200/50 dark:border-white/10 rounded-full flex items-center justify-center shadow-xs cursor-pointer"
            >
              <ChevronLeft size={22} className="text-[#0D2111] dark:text-white" />
            </motion.button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, category, or note..."
            className="w-full bg-white dark:bg-[#1C1C1E] border border-gray-200/70 dark:border-white/10 text-gray-900 dark:text-white text-[14px] font-semibold rounded-2xl pl-11 pr-10 py-3 outline-none focus:ring-2 focus:ring-[#C5F531]/50 dark:focus:ring-[#C5F531]/30 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal shadow-xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 space-y-4"
      >
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-[#1C1C1E]/50 rounded-[24px] border border-gray-200/40 dark:border-white/5 p-6">
            <p className="text-gray-500 dark:text-gray-400 font-medium text-[15px]">
              {searchQuery ? `No transactions found matching "${searchQuery}"` : "No transactions yet."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-3 text-[13px] font-bold text-emerald-600 dark:text-[#C5F531] hover:underline"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTransactions.map((tx: Transaction) => (
              <motion.div 
                key={tx.id} 
                layout
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)', x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <TransactionItem tx={tx} currency={currency} currencySymbol={currencySymbol} onClick={() => onTransactionSelect(tx.id)} onDelete={() => onDeleteTransaction(tx.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </motion.div>
  );
};

// -----------------------------
// BUDGET SCREEN COMPONENT
// -----------------------------
const BudgetScreen: React.FC<any> = ({ budget, setBudget, dailyLimit, setDailyLimit, currencySymbol, balance = 0, history = [], onBack }) => {
  const [amount, setAmount] = useState(budget.toString());
  const [dailyAmount, setDailyAmount] = useState(dailyLimit ? dailyLimit.toString() : '');

  const now = useMemo(() => new Date(), []);
  const daysInMonth = useMemo(() => getDaysInMonth(now.getFullYear(), now.getMonth()), [now]);
  const remainingDays = useMemo(() => getRemainingDaysInMonth(now), [now]);

  // Derived budget metrics from the financial calculation engine
  const metrics = useMemo<BudgetBreakdown>(() => {
    const bud = Number(amount) || 0;
    const inc = Number(balance) || 0;
    const savings = Math.max(0, inc - bud);
    return calculateBudgetMetrics({
      monthlyIncome: inc > 0 ? inc : bud,
      savingsGoal: inc > 0 ? savings : 0,
      fixedExpenses: 0,
      currentDate: now
    });
  }, [amount, balance, now]);

  const suggestedDaily = useMemo(() => {
    const bud = Number(amount);
    if (!bud || isNaN(bud) || bud <= 0) return 0;
    return Math.round((bud / remainingDays) * 100) / 100;
  }, [amount, remainingDays]);

  const suggestedBudget = useMemo(() => {
    if (history.length >= 3) {
      const last3 = history.slice(0, 3);
      const avg = last3.reduce((sum: any, h: any) => sum + h.expenses, 0) / 3;
      return Math.ceil(avg / 10) * 10;
    } else if (history.length > 0) {
      const avg = history.reduce((sum: any, h: any) => sum + h.expenses, 0) / history.length;
      return Math.ceil(avg / 10) * 10;
    }
    return null;
  }, [history]);

  const handleSave = () => {
    if (!amount || isNaN(Number(amount))) return;
    if (navigator.vibrate) navigator.vibrate(50);
    setBudget(Number(amount));
    
    if (dailyAmount && !isNaN(Number(dailyAmount))) {
      setDailyLimit(Number(dailyAmount));
    } else {
      setDailyLimit(suggestedDaily);
    }
    onBack();
  };

  return (
    <motion.div 
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full bg-[#F2F2F7] dark:bg-black flex flex-col relative"
    >
      {/* Header */}
      <div className="pt-14 px-6 flex justify-between items-center mb-6">
        <motion.button 
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onBack} 
          className="w-10 h-10 bg-white/40 dark:bg-white/5 border border-white/10 dark:border-white/5 rounded-full flex items-center justify-center shadow-sm cursor-pointer animate-none"
        >
          <ChevronLeft size={24} className="text-[#0D2111] dark:text-white" />
        </motion.button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">Monthly Budget</h1>
        <div className="w-10" />
      </div>

      <div className="px-6 flex-1 overflow-y-auto pb-24">
        <div className="liquid-glass-card rounded-[24px] p-6 shadow-sm mb-6">
          <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-4 font-medium">Set your monthly spending limit</p>
          <div className="flex items-center h-[56px] border-b border-gray-200 dark:border-gray-700">
            <span className="text-[28px] text-gray-900 dark:text-white mr-2 font-medium">{currencySymbol}</span>
            <input 
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-transparent text-[36px] font-bold text-gray-900 dark:text-white tracking-tighter outline-none placeholder:text-gray-300"
              placeholder="0.00"
              autoFocus
            />
          </div>
          {suggestedBudget && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2C2C2E] flex items-center justify-between">
              <span className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Suggested based on history</span>
              <button 
                onClick={() => setAmount(suggestedBudget.toString())}
                className="text-[13px] font-bold text-[#34C759] bg-[#E5F7ED] dark:bg-[#34C759]/10 px-3 py-1.5 rounded-full active:scale-95 transition-transform cursor-pointer"
              >
                Use {formatAmount(suggestedBudget, currencySymbol)}
              </button>
            </div>
          )}
        </div>

        <div className="liquid-glass-card rounded-[24px] p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] text-gray-500 dark:text-gray-400 font-medium">Set your daily spending limit</p>
            {suggestedDaily > 0 && (
              <button 
                onClick={() => setDailyAmount(Math.round(suggestedDaily).toString())}
                className="text-xs font-bold text-emerald-600 dark:text-[#C5F531] bg-emerald-50 dark:bg-[#C5F531]/10 px-2.5 py-1 rounded-full active:scale-95 transition-transform"
              >
                Auto: {currencySymbol}{Math.round(suggestedDaily)}/day
              </button>
            )}
          </div>
          <div className="flex items-center h-[56px] border-b border-gray-200 dark:border-gray-700">
            <span className="text-[28px] text-gray-900 dark:text-white mr-2 font-medium">{currencySymbol}</span>
            <input 
              type="number"
              value={dailyAmount}
              onChange={e => setDailyAmount(e.target.value)}
              className="w-full bg-transparent text-[36px] font-bold text-gray-900 dark:text-white tracking-tighter outline-none placeholder:text-gray-300"
              placeholder={suggestedDaily > 0 ? Math.round(suggestedDaily).toString() : "0.00"}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 font-medium">
            Calculated across {remainingDays} remaining days of this {daysInMonth}-day month.
          </p>
        </div>

        {/* Financial Calculation Breakdown Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-5 shadow-sm mb-6 border border-zinc-200/60 dark:border-zinc-800/80">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-mono tracking-wider font-bold text-zinc-500 dark:text-zinc-400">Financial Runway</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              metrics.status === 'deficit' 
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                : metrics.status === 'surplus'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}>
              {metrics.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#2C2C2E]/50">
              <span className="text-zinc-400 block mb-0.5">Days in Month</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-white">{daysInMonth} days</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#2C2C2E]/50">
              <span className="text-zinc-400 block mb-0.5">Remaining Runway</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-[#C5F531]">{remainingDays} days left</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#2C2C2E]/50">
              <span className="text-zinc-400 block mb-0.5">Spendable Pool</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatAmount(metrics.totalSpendablePool, currencySymbol)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-[#2C2C2E]/50">
              <span className="text-zinc-400 block mb-0.5">Daily Spend Limit</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-white">{formatAmount(metrics.dailySpendLimit, currencySymbol)}/day</span>
            </div>
          </div>

          {metrics.errorMessage && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{metrics.errorMessage}</span>
            </div>
          )}
        </div>

        <motion.button 
          onClick={handleSave}
          disabled={!amount || isNaN(Number(amount))}
          whileHover={(!amount || isNaN(Number(amount))) ? {} : { scale: 1.02, y: -2 }}
          whileTap={(!amount || isNaN(Number(amount))) ? {} : { scale: 0.98 }}
          className="w-full h-14 bg-[#0D2111] dark:bg-[#C5F531] disabled:bg-gray-300 text-white dark:text-[#0D2111] disabled:dark:text-gray-500 font-bold text-[16px] rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all flex items-center justify-center mb-10 cursor-pointer"
        >
          Save Budget
        </motion.button>

        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Previous Months</h2>
            <div className="space-y-4">
              {history.map((h: any, i: number) => {
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return (
                  <div key={i} className="liquid-glass-card p-5 rounded-[20px] shadow-sm flex flex-col mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[16px] font-bold text-gray-900 dark:text-white">{monthNames[h.month]} {h.year}</span>
                      <span className={`text-[14px] font-bold px-3 py-1 rounded-full ${h.expenses <= h.budget ? 'bg-[#E5F7ED] dark:bg-[#34C759]/10 text-[#34C759]' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                        {h.expenses <= h.budget ? 'Goal Reached' : 'Goal Missed'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[14px] mb-1">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Expenses</span>
                      <span className="text-gray-900 dark:text-white font-bold">{formatAmount(h.expenses, h.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[14px]">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Budget</span>
                      <span className="text-gray-900 dark:text-white font-bold">{formatAmount(h.budget, h.currencySymbol)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const TransactionDetailScreen: React.FC<{
  transaction?: Transaction;
  currencySymbol?: string;
  currency?: string;
  onBack: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}> = ({ transaction, currencySymbol = '$', currency = 'USD', onBack, onDelete, onEdit }) => {
  if (!transaction) return null;
  const theme = getCategoryTheme(transaction.category, transaction.type);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 bg-[#F2F2F7] dark:bg-black z-50 flex flex-col"
    >
      <div className="flex items-center justify-between px-6 pt-12 pb-4 bg-white dark:bg-[#1C1C1E]/50 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 dark:border-[#2C2C2E]/50">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#1C1C1E] rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.05)] active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft size={24} className="text-gray-900 dark:text-white" />
        </button>
        <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white">Transaction Details</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28 hide-scrollbar">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6 flex flex-col items-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${theme.avatarBg}`}>
             {React.cloneElement(theme.icon as React.ReactElement, { size: 28 })}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 text-center">{transaction.title}</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium mb-4 text-center">{transaction.subtitle}</p>
          
          <div className="mb-6">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${theme.pillBg}`}>
              {theme.name}
            </span>
          </div>

          <div className={`text-4xl font-bold tracking-tight mb-2 ${transaction.type === 'expense' || transaction.type === 'send' || transaction.type === 'withdraw' ? 'text-red-500' : 'text-green-500'}`}>
            {transaction.type === 'expense' || transaction.type === 'send' || transaction.type === 'withdraw' ? '-' : '+'}{formatAmount(Math.abs(transaction.amount), currencySymbol)}
          </div>
          
          <div className="w-full bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl p-4 mt-6 flex flex-col gap-3">
            <div className="flex justify-between items-center">
               <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">Date</span>
               <span className="text-gray-900 dark:text-white font-semibold text-sm">{transaction.date}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">Time</span>
               <span className="text-gray-900 dark:text-white font-semibold text-sm">{transaction.time}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">Category</span>
               <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${theme.pillBg}`}>
                 {theme.name}
               </span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">Type</span>
               <span className="text-gray-900 dark:text-white font-semibold text-sm capitalize">{transaction.type}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-6 bg-white dark:bg-[#1C1C1E]/50 backdrop-blur-md sticky bottom-0 border-t border-gray-100 dark:border-[#2C2C2E]/50 flex gap-4 mt-auto">
         <button 
           onClick={() => onEdit(transaction.id)}
           className="flex-1 h-14 bg-gray-100 dark:bg-[#2C2C2E] text-gray-900 dark:text-white font-bold text-[16px] rounded-full active:scale-[0.98] transition-all flex items-center justify-center gap-2"
         >
           <Edit2 size={18} />
           Edit
         </button>
         <button 
           onClick={() => onDelete(transaction.id)}
           className="flex-1 h-14 bg-red-500 text-white font-bold text-[16px] rounded-full shadow-[0_8px_20px_rgba(239,68,68,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
         >
           <Trash2 size={18} />
           Delete
         </button>
      </div>
    </motion.div>
  );
};

const WalletScreen: React.FC<any> = ({ onBack, transactions, budget, balance, currency, currencySymbol = '$' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (containerRef.current?.querySelector('.gsap-wallet-card')) {
      gsap.fromTo('.gsap-wallet-card',
        { opacity: 0, scale: 0.8, rotate: 0 },
        {
          opacity: 1,
          scale: 1,
          stagger: 0.1,
          duration: 0.6,
          ease: "back.out(1.2)",
          clearProps: 'transform' // Let Tailwind handle the static rotation classes after animation
        }
      );
    }

    if (containerRef.current?.querySelector('.gsap-wallet-tx')) {
      gsap.fromTo('.gsap-wallet-tx', 
        { opacity: 0, y: 20 },
        { 
          opacity: 1, 
          y: 0, 
          stagger: 0.1,
          ease: "power2.out",
          duration: 0.5,
          delay: 0.3
        }
      );
    }
  }, { scope: containerRef });

  return (
    <motion.div 
      ref={containerRef}
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full overflow-y-auto hide-scrollbar bg-[#F2F2F7] dark:bg-black relative pb-36"
    >
      <div className="pt-14 px-6 flex justify-between items-center mb-6">
        <h1 className="text-[28px] font-bold text-[#0D2111] tracking-tight">Wallet</h1>
        <div className="w-10 h-10 bg-white dark:bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-sm cursor-pointer border border-gray-200 dark:border-gray-700">
          <Plus size={20} className="text-[#0D2111]" />
        </div>
      </div>

      <div className="px-6 mb-8 relative h-[220px]">
        {/* Card 3 (back) */}
        <div className="absolute top-4 left-4 right-4 h-[180px] bg-[#0D2111] rounded-[24px] rotate-[6deg] opacity-60 origin-bottom-right gsap-wallet-card" />
        {/* Card 2 (middle) */}
        <div className="absolute top-2 left-2 right-2 h-[180px] bg-white dark:bg-[#1C1C1E] rounded-[24px] rotate-[3deg] shadow-md origin-bottom-right gsap-wallet-card" />
        {/* Card 1 (front) */}
        <div className="absolute top-0 left-0 right-0 h-[190px] bg-[#C5F531] rounded-[24px] shadow-lg p-6 flex flex-col justify-between gsap-wallet-card card-3d-effect">
          <div className="flex justify-between items-start">
            <span className="text-[#0D2111] font-black text-[20px] tracking-tight">Monthly Budget</span>
            <div className="bg-[#0D2111] text-[#C5F531] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Active</div>
          </div>
          <div>
            <p className="text-[#0D2111]/70 text-[12px] font-medium mb-1">Total Limit</p>
            <h2 className="text-[#0D2111] text-[32px] font-bold tracking-tight leading-none">{formatAmount(budget, currencySymbol)}</h2>
          </div>
        </div>
      </div>

      <div className="px-6 mb-8">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center">
              <PieChartIcon size={20} className="text-[#0D2111]" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#0D2111]">Budget Details</h3>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">Manage your limits</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
      </div>

      <div className="px-6">
        <h2 className="text-[20px] font-bold text-[#0D2111] tracking-tight mb-4">Transactions</h2>
        <div className="space-y-4">
          <AnimatePresence>
            {transactions.slice(0, 5).map((tx: Transaction, index: number) => (
              <motion.div key={tx.id} className="gsap-wallet-tx" layout>
                <TransactionItem tx={tx} currency={currency} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

const ProfileScreen: React.FC<any> = ({ user, isPremium, onLogout, onBack, onNavigate, onUpdateProfilePicture, onResetPremium }) => {
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetPremium = async () => {
    try {
      setResetLoading(true);
      setResetError(null);
      setResetSuccess(null);
      const token = localStorage.getItem('smart_expenses_user_token') || 'local_user';
      const response = await fetch('/api/stripe/reset-premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to reset premium status.");
      }
      setResetSuccess("🔄 Premium status successfully reset to Basic!");
      setTimeout(() => {
        if (onResetPremium) onResetPremium();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setResetError(err.message || "An error occurred while resetting premium.");
    } finally {
      setResetLoading(false);
    }
  };

  const menuItems = [
    { icon: <User size={20} />, label: 'Personal Info', id: 'personal_info' },
    { icon: <Shield size={20} />, label: 'Security', id: 'security' },
    ...(!isPremium ? [{ icon: <Sparkles size={20} className="text-amber-500 fill-amber-500/20" />, label: 'Upgrade to Pro ($5)', id: 'analytics' }] : []),
    { icon: <Bell size={20} />, label: 'Notifications', id: 'notifications' },
    { icon: <Goal size={20} />, label: 'Rewards & Loyalty', id: 'rewards' },
    { icon: <HelpCircle size={20} />, label: 'Help & Support', id: 'help_support' },
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            onUpdateProfilePicture(compressedBase64);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain touch-pan-y hide-scrollbar bg-[#FFFFFF] dark:bg-black pb-36 relative"
    >
      <div className="pt-12 px-6 flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-black text-[#0D2111] dark:text-white tracking-tighter">Account</h1>
        <motion.button 
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => onNavigate('settings')} 
          className="w-10 h-10 bg-gray-50 dark:bg-[#2C2C2E]/50 border border-transparent dark:border-white/5 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
        >
          <Settings size={20} className="text-[#0D2111] dark:text-white" />
        </motion.button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-6 flex flex-col items-center mb-10 liquid-glass-card rounded-[40px] py-12 shadow-sm"
      >
        <div className="relative mb-6">
          <div className="w-28 h-28 bg-white dark:bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-lg overflow-hidden border-4 border-white dark:border-white/10">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-gray-300" />
            )}
          </div>
          <motion.button 
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            onClick={handleUploadClick}
            className="absolute bottom-0 right-0 w-8 h-8 bg-[#C5F531] text-[#0D2111] rounded-full flex items-center justify-center shadow-md hover:shadow-lg border-2 border-white dark:border-[#1C1C1E] transition-all cursor-pointer z-10"
          >
            <Plus size={16} className="stroke-[3]" />
          </motion.button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        <h2 className="text-[28px] font-black text-[#0D2111] dark:text-white tracking-tighter">{user?.displayName || 'Guest User'}</h2>
        <div className={`mt-3 px-5 py-2 rounded-full text-[13px] font-black tracking-widest uppercase shadow-md ${
          isPremium 
            ? 'bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111]' 
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
        }`}>
          {isPremium ? 'PRO MEMBER' : 'BASIC MEMBER'}
        </div>
      </motion.div>

      <div className="px-8 mb-5">
         <p className="text-[14px] font-bold text-gray-400 dark:text-gray-500">Settings</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mx-6 liquid-glass-card rounded-[36px] p-3 mb-6 shadow-sm"
      >
        <div className="space-y-1">
          {menuItems.map((item, i) => (
            <motion.button 
              key={i} 
              whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate(item.id)} 
              className="w-full flex items-center justify-between p-4 cursor-pointer rounded-[28px] transition-all text-left"
            >
              <div className="flex items-center space-x-5">
                <div className="w-14 h-14 bg-white/40 dark:bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-[#0D2111] dark:text-white shadow-sm">
                  {item.icon}
                </div>
                <span className="text-[16px] font-black text-[#0D2111] dark:text-white tracking-tight">{item.label}</span>
              </div>
              <ChevronRight size={20} className="text-gray-300 dark:text-gray-600" />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mx-6 liquid-glass-card rounded-[36px] p-3 shadow-sm mb-6"
        >
          <motion.button 
            whileHover={{ scale: 1.01, backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
            whileTap={{ scale: 0.97 }}
            onClick={handleResetPremium}
            disabled={resetLoading}
            className="w-full flex items-center justify-between p-4 cursor-pointer rounded-[28px] transition-all text-left"
          >
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center text-red-500 shadow-sm">
                <RefreshCw size={20} className={resetLoading ? "animate-spin" : ""} />
              </div>
              <div>
                <span className="text-[16px] font-black text-red-500 tracking-tight block">Reset Premium Status</span>
                <span className="text-[12px] text-gray-500 dark:text-gray-400 font-medium block">Reset your account to Basic for testing</span>
              </div>
            </div>
            {resetLoading ? (
              <span className="text-xs text-red-500 font-bold uppercase tracking-wider">Resetting...</span>
            ) : (
              <ChevronRight size={20} className="text-gray-300 dark:text-gray-600" />
            )}
          </motion.button>
          
          {resetSuccess && (
            <div className="px-6 py-2 text-center text-xs text-emerald-500 font-black tracking-wide">
              {resetSuccess}
            </div>
          )}
          {resetError && (
            <div className="px-6 py-2 text-center text-xs text-red-500 font-black tracking-wide">
              {resetError}
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mx-6 liquid-glass-card rounded-[36px] p-3 shadow-sm mb-6"
      >
        <motion.button 
          whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 59, 48, 0.05)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onLogout}
          className="w-full flex items-center justify-between p-4 cursor-pointer rounded-[28px] transition-all text-left"
        >
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-[#FFF0F0] dark:bg-[#FF3B30]/10 rounded-full flex items-center justify-center text-[#FF3B30] shadow-sm">
              <LogOut size={20} />
            </div>
            <span className="text-[16px] font-black text-[#FF3B30] tracking-tight">Sign Out</span>
          </div>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

const GenericSubScreen: React.FC<{
  title: string,
  onBack: () => void,
  user?: any,
  isPremium?: boolean,
  transactions?: any,
  budget?: any,
  currencySymbol?: any,
  notifications?: any,
  setNotifications?: any
}> = ({ title, onBack, user, isPremium }) => {
  return (
    <motion.div 
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="flex-1 w-full h-full bg-[#F2F2F7] dark:bg-black flex flex-col relative z-50 overflow-hidden"
    >
      <div className="pt-14 px-6 flex items-center justify-between mb-8">
        <button onClick={onBack} className="w-10 h-10 bg-white dark:bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-sm text-gray-900 dark:text-white">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[18px] font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
        <div className="w-10 h-10" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-20">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-sm space-y-6">
          {title.includes('Personal') && (
            <>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-[#2C2C2E] rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">{user?.displayName || 'Guest User'}</h2>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400">Account Details</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 ml-2 mb-2 block">Full Name</label>
                  <input type="text" readOnly value={user?.displayName || "Guest User"} className="w-full h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl px-4 font-bold text-gray-900 dark:text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 ml-2 mb-2 block">Email Address</label>
                  <input type="email" readOnly value={user?.email || "user@example.com"} className="w-full h-12 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl px-4 font-bold text-gray-900 dark:text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 ml-2 mb-2 block">Subscription Tier</label>
                  <div className={`w-full h-12 rounded-2xl px-4 font-bold flex items-center justify-between ${isPremium ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300'}`}>
                    <span>{isPremium ? 'Pro Member (2 Months Access)' : 'Basic Member'}</span>
                    {isPremium && <span className="text-xs bg-emerald-500 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold">Active</span>}
                  </div>
                </div>
              </div>
            </>
          )}
          {title.includes('Security') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Change Password</h2>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Update your account password</p>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Two-Factor Auth</h2>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Add an extra layer of security</p>
                </div>
                <div className="w-10 h-6 bg-[#34C759] rounded-full p-1"><div className="w-4 h-4 bg-white dark:bg-[#1C1C1E] rounded-full transform translate-x-4" /></div>
              </div>
            </div>
          )}
          {title.includes('Notification') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Push Notifications</h2>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Receive alerts on your phone</p>
                </div>
                <div className="w-10 h-6 bg-[#34C759] rounded-full p-1"><div className="w-4 h-4 bg-white dark:bg-[#1C1C1E] rounded-full transform translate-x-4" /></div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-2xl">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white">Email Alerts</h2>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Get weekly summaries</p>
                </div>
                <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full p-1"><div className="w-4 h-4 bg-white dark:bg-[#1C1C1E] rounded-full" /></div>
              </div>
            </div>
          )}
          {title.includes('Support') && (
            <div className="space-y-4 text-center">
              <HelpCircle size={48} className="mx-auto text-gray-300 dark:text-gray-600 dark:text-gray-300 mb-4" />
              <h2 className="font-bold text-gray-900 dark:text-white">How can we help?</h2>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6">Our support team is available 24/7</p>
              <button className="w-full h-12 bg-[#0D2111] text-white font-bold rounded-full">Contact Support</button>
            </div>
          )}
          {title.includes('Settings') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <h2 className="font-bold text-gray-900">Language</h2>
                  <p className="text-[12px] text-gray-500">Choose your language</p>
                </div>
                <span className="text-[14px] font-bold text-[#34C759]">English</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const EditTransactionScreen: React.FC<{
  transaction?: Transaction;
  currencySymbol?: string;
  onBack: () => void;
  onSave: (id: string, newAmount: number, newTitle: string) => void;
}> = ({ transaction, currencySymbol = '$', onBack, onSave }) => {
  const [amount, setAmount] = useState(transaction?.amount.toString() || '');
  const [title, setTitle] = useState(transaction?.title || '');

  const handleSave = () => {
    if (transaction && amount && title) {
      onSave(transaction.id, parseFloat(amount), title);
    }
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#F2F2F7] dark:bg-black z-[100] flex flex-col"
    >
      <div className="pt-14 px-6 flex justify-between items-center mb-8">
        <button onClick={onBack} className="w-10 h-10 bg-white dark:bg-[#1C1C1E] rounded-full flex items-center justify-center shadow-sm text-gray-900 dark:text-white">
          <X size={20} />
        </button>
        <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">Edit Transaction</h1>
        <div className="w-10 h-10" />
      </div>

      <div className="px-6 space-y-6 flex-1">
        <div>
          <label className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 ml-2 mb-2 block">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currencySymbol}</span>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-14 bg-white dark:bg-[#1C1C1E] rounded-[20px] pl-8 pr-4 font-bold text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#34C759]"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 ml-2 mb-2 block">Title</label>
          <input 
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-14 bg-white dark:bg-[#1C1C1E] rounded-[20px] px-4 font-bold text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#34C759]"
          />
        </div>
      </div>

      <div className="p-6 pb-12">
        <button 
          onClick={handleSave}
          className="w-full h-14 bg-[#34C759] text-white font-bold text-[17px] rounded-full shadow-lg"
        >
          Save Changes
        </button>
      </div>
    </motion.div>
  );
};


