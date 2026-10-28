import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  CreditCard, 
  Lock, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  Building2, 
  User, 
  Mail, 
  Info,
  Check
} from 'lucide-react';

const getAuthToken = () => {
  return localStorage.getItem('smart_expenses_user_token') || 'local_user_token';
};

interface PaymentGatewayProps {
  amount?: number;
  currency?: string;
  productName?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

// CardElement custom styling to match dark/light theme
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '15px',
      '::placeholder': {
        color: '#94a3b8',
      },
      iconColor: '#10b981',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
};

// Sub-component that sits inside <Elements> context
const PaymentFormContent: React.FC<{
  amount: number;
  currency: string;
  productName: string;
  clientSecret: string;
  paymentIntentId: string;
  isDemoMode: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}> = ({
  amount,
  currency,
  productName,
  clientSecret,
  paymentIntentId,
  isDemoMode,
  onSuccess,
  onCancel
}) => {
  const stripe = useStripe();
  const elements = useElements();

  const [cardholderName, setCardholderName] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('smart_expenses_user_email') || 'user@example.com');
  const [postalCode, setPostalCode] = useState('');
  
  // Custom manual card state for demo mode / fallback
  const [demoCardNumber, setDemoCardNumber] = useState('4242 •••• •••• 4242');
  const [demoExpiry, setDemoExpiry] = useState('12/28');
  const [demoCvc, setDemoCvc] = useState('123');

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'amex' | 'generic'>('visa');

  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // Handle real-time CardElement changes (detect incomplete number, expiry, CVC)
  const handleCardChange = (event: any) => {
    setCardComplete(event.complete);
    if (event.error) {
      setCardError(event.error.message);
      setErrorMessage(null); // Keep field-level error distinct
    } else {
      setCardError(null);
    }
  };

  // Handle card number brand detection for fallback inputs
  const handleCardNumberChange = (val: string) => {
    // Format card number with spaces
    const cleaned = val.replace(/\D/g, '').slice(0, 16);
    let formatted = cleaned;
    if (cleaned.length > 0) {
      formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    }
    setDemoCardNumber(formatted);
    setCardError(null);
    setErrorMessage(null);

    if (cleaned.startsWith('4')) setCardBrand('visa');
    else if (cleaned.startsWith('5') || cleaned.startsWith('2')) setCardBrand('mastercard');
    else if (cleaned.startsWith('3')) setCardBrand('amex');
    else setCardBrand('generic');
  };

  const handleExpiryChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 4);
    setCardError(null);
    setErrorMessage(null);
    if (cleaned.length >= 3) {
      setDemoExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setDemoExpiry(cleaned);
    }
  };

  // Quick fill helper for testing cards
  const fillTestCard = (brandType: 'visa' | 'mastercard') => {
    setErrorMessage(null);
    setCardError(null);
    if (brandType === 'visa') {
      setDemoCardNumber('4242 4242 4242 4242');
      setDemoExpiry('12/28');
      setDemoCvc('123');
      setCardBrand('visa');
      if (!cardholderName.trim()) setCardholderName('Jane Doe');
      if (!postalCode.trim()) setPostalCode('110001');
    } else {
      setDemoCardNumber('5555 5555 5555 4444');
      setDemoExpiry('11/27');
      setDemoCvc('456');
      setCardBrand('mastercard');
      if (!cardholderName.trim()) setCardholderName('John Smith');
      if (!postalCode.trim()) setPostalCode('400001');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!cardholderName.trim()) {
      setErrorMessage('Please enter the name on card.');
      return;
    }

    if (!isDemoMode && stripe && elements) {
      if (cardError) {
        setErrorMessage(cardError);
        return;
      }
      if (!cardComplete) {
        setErrorMessage('Please complete your card details (card number, expiration date, and CVC).');
        return;
      }
    } else {
      // Validate sandbox/demo manual inputs
      const cleanNum = demoCardNumber.replace(/\D/g, '');
      if (cleanNum.length < 13) {
        setErrorMessage('Your card number is incomplete. Please enter a valid 16-digit card number.');
        return;
      }
      const cleanExp = demoExpiry.replace(/\D/g, '');
      if (cleanExp.length < 4) {
        setErrorMessage('Your expiry date is incomplete. Please enter MM/YY.');
        return;
      }
      const expMonth = parseInt(cleanExp.substring(0, 2), 10);
      if (expMonth < 1 || expMonth > 12) {
        setErrorMessage('Invalid expiry month. Month must be between 01 and 12.');
        return;
      }
      if (demoCvc.length < 3) {
        setErrorMessage('Your card CVC code is incomplete. Please enter 3 or 4 digits.');
        return;
      }
    }

    setIsProcessing(true);

    try {
      const token = getAuthToken();

      // If real Stripe API key is active and stripe/elements loaded
      if (!isDemoMode && stripe && elements) {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error('Stripe card element failed to initialize.');
        }

        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement as any,
            billing_details: {
              name: cardholderName,
              email: email,
              address: {
                postal_code: postalCode,
              }
            }
          }
        });

        if (error) {
          throw new Error(error.message || 'Payment confirmation failed.');
        }

        if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
          // Confirm with backend to update user database status
          const confirmRes = await fetch('/api/stripe/confirm-payment-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id })
          });

          const confirmData = await confirmRes.json();
          if (!confirmRes.ok) {
            throw new Error(confirmData.error || 'Failed to finalize account upgrade.');
          }

          setIsSuccess(true);
          setTimeout(() => {
            onSuccess();
          }, 1800);
        } else {
          throw new Error(`Unexpected payment status: ${paymentIntent?.status}`);
        }
      } else {
        // Sandbox Demo Processing Simulation
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const confirmRes = await fetch('/api/stripe/confirm-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ paymentIntentId })
        });

        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) {
          throw new Error(confirmData.error || 'Failed to complete demo upgrade.');
        }

        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1800);
      }
    } catch (err: any) {
      console.error('Payment processing error:', err);
      const rawMsg = err?.message || '';
      
      if (rawMsg.toLowerCase().includes('card number is incomplete')) {
        setErrorMessage('Your card number is incomplete. Please enter the full 16-digit card number.');
      } else if (rawMsg.toLowerCase().includes('expiry date is incomplete') || rawMsg.toLowerCase().includes('expiration date is incomplete')) {
        setErrorMessage('Your expiry date is incomplete. Please enter the month and year (MM/YY).');
      } else if (rawMsg.toLowerCase().includes('card number is incorrect') || rawMsg.toLowerCase().includes('invalid card number')) {
        setErrorMessage('Your card number is incorrect. Please double-check your card number or use a test card.');
      } else if (rawMsg.toLowerCase().includes('security code is incomplete') || rawMsg.toLowerCase().includes('cvc is incomplete')) {
        setErrorMessage('Your security code (CVC) is incomplete.');
      } else {
        setErrorMessage(rawMsg || 'Payment processing failed. Please check your card details and try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-10 px-6 text-center flex flex-col items-center justify-center space-y-4"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 size={36} className="stroke-[2.5]" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
          Payment Successful!
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm">
          Your payment of <span className="font-bold text-zinc-900 dark:text-white">₹{amount} {currency}</span> was processed securely. Upgrading your account...
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-900/30">
          <Sparkles size={14} />
          Pro Features Activated
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left">
      {/* Product Summary Header */}
      <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Item</span>
          <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{productName}</h3>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Amount</span>
          <p className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{amount} <span className="text-xs font-normal text-zinc-400">{currency}</span></p>
        </div>
      </div>

      {isDemoMode && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
          <Info size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-bold">Sandbox Test Mode: </span>
            <span>Payment gateway key is in demo mode. You can test card entry using standard test numbers (e.g., 4242 4242 4242 4242).</span>
          </div>
        </div>
      )}

      {/* Cardholder Information */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
            <User size={13} className="text-zinc-400" />
            Cardholder Name
          </label>
          <input 
            type="text"
            required
            placeholder="e.g. Rahul Sharma"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Mail size={13} className="text-zinc-400" />
              Receipt Email
            </label>
            <input 
              type="email"
              required
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Building2 size={13} className="text-zinc-400" />
              Postal / Zip Code
            </label>
            <input 
              type="text"
              placeholder="e.g. 110001"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Smart Payments Card Input Container */}
      <div>
        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CreditCard size={13} className="text-zinc-400" />
            Card Details (Smart Payments)
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Lock size={11} /> 256-Bit SSL
          </span>
        </label>

        {!isDemoMode && stripe ? (
          <div className="space-y-2">
            <div className={`bg-white dark:bg-zinc-900 border rounded-xl p-3.5 focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all ${
              cardError 
                ? 'border-red-500 ring-2 ring-red-500/20' 
                : 'border-zinc-200 dark:border-zinc-700/80'
            }`}>
              <CardElement 
                options={CARD_ELEMENT_OPTIONS} 
                onChange={handleCardChange}
              />
            </div>
            {cardError && (
              <p className="text-[12px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5 px-1">
                <AlertCircle size={13} className="shrink-0" />
                <span>{cardError}</span>
              </p>
            )}
          </div>
        ) : (
          /* Custom styled card input preview for demo sandbox mode */
          <div className="space-y-2.5">
            <div className="relative">
              <input 
                type="text"
                placeholder="4242 4242 4242 4242"
                value={demoCardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl pl-3.5 pr-12 py-2.5 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-zinc-400 uppercase">
                {cardBrand}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <input 
                  type="text"
                  placeholder="MM/YY"
                  value={demoExpiry}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
              <div>
                <input 
                  type="password"
                  maxLength={4}
                  placeholder="CVC / CVV"
                  value={demoCvc}
                  onChange={(e) => {
                    setCardError(null);
                    setErrorMessage(null);
                    setDemoCvc(e.target.value.replace(/\D/g, ''));
                  }}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            </div>

            {/* Quick Test Cards Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Quick Fill:</span>
              <button
                type="button"
                onClick={() => fillTestCard('visa')}
                className="text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Visa 4242
              </button>
              <button
                type="button"
                onClick={() => fillTestCard('mastercard')}
                className="text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                MC 5555
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl p-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold"
        >
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {/* Submit CTA */}
      <div className="pt-2 space-y-2">
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer text-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Processing Secure Payment...
            </>
          ) : (
            <>
              <Lock size={16} />
              Pay ₹{amount} {currency} Securely
            </>
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer text-center"
          >
            Cancel and Return
          </button>
        )}
      </div>

      {/* Footer Security Badges */}
      <div className="pt-2 flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 font-medium border-t border-zinc-100 dark:border-zinc-800/80">
        <span className="flex items-center gap-1">
          <ShieldCheck size={13} className="text-emerald-500" /> Smart Payments Encrypted
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Check size={13} className="text-emerald-500" /> PCI DSS Level 1 Compliant
        </span>
      </div>
    </form>
  );
};

// Main Exported Wrapper Component
export const PaymentGateway: React.FC<PaymentGatewayProps> = ({
  amount = 399,
  currency = 'INR',
  productName = 'Pro Upgrade - Expense Sheets & AI Analytics',
  onSuccess,
  onCancel
}) => {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeStripeElements = async () => {
      try {
        setLoading(true);
        setInitError(null);

        // 1. Fetch Stripe config
        const configRes = await fetch('/api/stripe/config');
        if (!configRes.ok) throw new Error('Failed to fetch stripe config');
        const configData = await configRes.json();
        
        const pubKey = configData.publishableKey || 'pk_test_sample_key';
        
        // Initialize Stripe SDK with publishable key
        if (pubKey && pubKey !== 'pk_test_sample_key') {
          setStripePromise(loadStripe(pubKey));
        }

        // 2. Create PaymentIntent on server
        const token = getAuthToken();
        const intentRes = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ amount: amount * 100, currency: currency.toLowerCase() })
        });

        const intentData = await intentRes.json();
        if (!intentRes.ok) {
          throw new Error(intentData.error || 'Failed to create payment intent.');
        }

        if (isMounted) {
          setClientSecret(intentData.clientSecret);
          setPaymentIntentId(intentData.paymentIntentId);
          setIsDemoMode(Boolean(intentData.isDemoMode));
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to connect to payment gateway.';
        console.error('Stripe initialization error:', err);
        if (isMounted) {
          setInitError(errMsg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeStripeElements();

    return () => {
      isMounted = false;
    };
  }, [amount, currency]);

  if (loading) {
    return (
      <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Initializing Stripe Elements Payment Gateway...
        </p>
      </div>
    );
  }

  if (initError) {
    const isAuthRequired = initError.toLowerCase().includes('sign in');
    return (
      <div className="p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-center space-y-4">
        <AlertCircle size={32} className="text-amber-500 mx-auto" />
        <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">
          {isAuthRequired ? "Sign In Required" : "Gateway Error"}
        </h4>
        <p className="text-xs text-amber-700 dark:text-amber-400 max-w-xs mx-auto">{initError}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {onCancel && (
            <button 
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-xl">
      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <PaymentFormContent
            amount={amount}
            currency={currency}
            productName={productName}
            clientSecret={clientSecret}
            paymentIntentId={paymentIntentId}
            isDemoMode={isDemoMode}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        </Elements>
      )}
    </div>
  );
};
