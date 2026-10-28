import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PaymentGateway } from './PaymentGateway';
import { 
  ShieldCheck, 
  Check, 
  Sparkles, 
  TrendingUp, 
  Download, 
  CreditCard, 
  Lock, 
  RefreshCw,
  ArrowLeft,
  Zap
} from 'lucide-react';

const getAuthToken = () => {
  return localStorage.getItem('smart_expenses_user_token') || 'local_user_token';
};

interface PremiumPaywallProps {
  isPremium?: boolean;
  onResetPremium?: () => void;
  onUpgradeSuccess: () => void;
  onBack: () => void;
}

export const PremiumPaywall: React.FC<PremiumPaywallProps> = ({ isPremium = false, onResetPremium, onUpgradeSuccess, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activePaymentMode, setActivePaymentMode] = useState<'elements' | 'checkout' | 'options'>('options');

  const handleResetPremium = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      const token = getAuthToken();
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
      setSuccessMsg("🔄 Premium status successfully reset to Basic!");
      setTimeout(() => {
        if (onResetPremium) onResetPremium();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while resetting premium.");
    } finally {
      setLoading(false);
    }
  };

  // Auto verify Stripe payment on redirection mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const success = params.get('success');
    
    if (sessionId && success === 'true') {
      const verifyStripePayment = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const token = getAuthToken();
          const verifyRes = await fetch('/api/stripe/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId })
          });
          
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) {
            throw new Error(verifyData.error || "Failed to verify Stripe payment.");
          }
          
          setSuccessMsg("🎉 Dhanyawad! Smart Payment verified & Pro Upgrade successful!");
          // Clean up URL query parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          setTimeout(() => {
            onUpgradeSuccess();
          }, 2000);
        } catch (err: any) {
          console.error(err);
          setError(err.message || "Failed to verify payment session.");
        } finally {
          setLoading(false);
        }
      };
      
      verifyStripePayment();
    }
  }, []);

  // Upgrade securely using Stripe Checkout (Redirect Mode)
  const handleStripeCheckout = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create Stripe Checkout Session on Backend
      const token = getAuthToken();
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const sessionData = await response.json();
      if (!response.ok) {
        throw new Error(sessionData.error || "Failed to initiate Stripe Checkout session.");
      }

      // Redirect user directly to Stripe Checkout hosted page
      if (sessionData.url) {
        window.location.href = sessionData.url;
      } else {
        throw new Error("Stripe checkout URL was not returned from the server.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Verify your Stripe secret key is configured in .env.");
      setLoading(false);
    }
  };

  if (isPremium) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950 px-4 py-8 md:px-8">
        {/* Header Navigation */}
        <div className="max-w-3xl mx-auto mb-8 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium text-sm cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs px-3 py-1 rounded-full font-black tracking-widest uppercase border border-emerald-200 dark:border-emerald-900/30">
            PRO MEMBER
          </span>
        </div>

        {/* Main Container */}
        <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden mb-12">
          <div className="p-8 md:p-12 flex flex-col items-center text-center">
            
            {/* Hero Visual Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C5F531] to-[#A3D31B] flex items-center justify-center text-[#0D2111] mb-6 shadow-md shadow-[#C5F531]/10">
              <ShieldCheck size={32} />
            </div>

            {/* Title and Subtitle */}
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-3">
              Premium Upgrade Active
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-md text-sm md:text-base leading-relaxed mb-8">
              Dhanyawad! Your payment was processed successfully through Smart Payments. You have 2 Months of active Pro access.
            </p>

            {/* Premium Features List */}
            <div className="w-full max-w-md bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/80 mb-8 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <Check className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Unlimited Interactive Expense Sheets</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Predictive Balance Graph Analytics</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="text-emerald-500 w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Smart AI-Powered Financial Forecasting</span>
              </div>
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={onBack}
                className="w-full bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111] font-bold py-4 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg cursor-pointer text-sm"
              >
                Go back
              </button>

              {onResetPremium && (
                <button
                  onClick={handleResetPremium}
                  disabled={loading}
                  className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-500 font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Reset Premium Status for Testing
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Status alerts inside Premium active container */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0 }}
                  className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl p-4 text-xs font-semibold w-full mt-6 text-left"
                >
                  {error}
                </motion.div>
              )}
              {successMsg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0 }}
                  className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-xs font-semibold w-full mt-6 text-center"
                >
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950 px-4 py-8 md:px-8">
      {/* Header Navigation */}
      <div className="max-w-3xl mx-auto mb-8 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium text-sm cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>
        <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold tracking-wide border border-emerald-100 dark:border-emerald-900/30">
          PRO EDITION (2 MONTHS PASS)
        </span>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden mb-12">
        <div className="p-8 md:p-12 flex flex-col items-center text-center">
          
          {/* Hero Visual Badge */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white mb-6 shadow-md shadow-emerald-500/10">
            <Sparkles size={32} />
          </div>

          {/* Title and Subtitle */}
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-3">
            Unlock Smart Analytics
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md text-sm md:text-base leading-relaxed mb-8">
            Access deep predictive graphs, instant expense sheets, and Smart AI-powered financial forecasts with secure payment processing.
          </p>

          {/* Pricing display */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl px-8 py-4 mb-8 border border-zinc-100 dark:border-zinc-800/80 w-full max-w-sm flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400 font-semibold text-sm">2-Month Pro Pass</span>
            <div className="text-right">
              <span className="text-3xl font-black text-zinc-900 dark:text-white">₹99</span>
              <span className="text-zinc-400 text-xs ml-1 font-medium">INR</span>
            </div>
          </div>

          {/* Features Checklist */}
          <div className="w-full max-w-md space-y-4 mb-8 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                <Check size={14} className="stroke-[3]" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Interactive Expense Sheets</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Full tabular breakdown of transactions with dynamic filtering.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                <Check size={14} className="stroke-[3]" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Predictive Balance Graphs</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Visualize your projected month-end balance with smart trend lines.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                <Check size={14} className="stroke-[3]" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Smart AI Predictive Insights</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Receive AI predictions to avoid going over your monthly budget.</p>
              </div>
            </div>
          </div>

          {/* Status alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl p-4 text-xs font-semibold w-full mb-6 text-left"
              >
                {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-xs font-semibold w-full mb-6 text-center"
              >
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Embedded Smart Payments Gateway vs Options */}
          <div className="w-full space-y-4">
            {activePaymentMode === 'elements' ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
              >
                <div className="mb-4 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Zap size={14} className="text-emerald-500" />
                    Direct Card Payment (Smart Payments)
                  </span>
                  <button
                    onClick={() => setActivePaymentMode('options')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Change Method
                  </button>
                </div>
                <PaymentGateway
                  amount={99}
                  currency="INR"
                  productName="Pro Upgrade - 2 Months Access"
                  onSuccess={() => {
                    setSuccessMsg("🎉 Pro Upgrade Completed Successfully! Redirecting to Smart Analytics...");
                    setTimeout(() => {
                      onUpgradeSuccess();
                    }, 1200);
                  }}
                  onCancel={() => setActivePaymentMode('options')}
                />
              </motion.div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setActivePaymentMode('elements')}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 cursor-pointer text-sm"
                >
                  <CreditCard size={18} />
                  Pay Now with Card (Smart Payments)
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

