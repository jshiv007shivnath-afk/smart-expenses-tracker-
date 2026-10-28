/**
 * Financial Calculation Engine
 * 
 * Strict personal finance formulas with mathematical precision:
 * 1. income: Total recurring inflow for the period (monthly income).
 * 2. savings_goal: Target absolute amount set aside that MUST NOT be spent.
 * 3. fixed_expenses: Non-negotiable costs (rent, bills, EMIs).
 * 4. total_spendable_budget: income - savings_goal - fixed_expenses (The actual pool of disposable money).
 * 5. daily_spend_limit: total_spendable_budget / remaining_days_in_period (The allowed expenditure per day).
 * 6. daily_savings_rate: savings_goal / days_in_period (Informational metric for savings accumulation).
 */

export interface BudgetInputs {
  monthlyIncome: number;
  savingsGoal: number;
  fixedExpenses?: number;
  currentDate?: Date;
}

export interface BudgetBreakdown {
  totalSpendablePool: number;
  dailySpendLimit: number;
  dailySavingsTarget: number;
  daysInMonth: number;
  remainingDays: number;
  status: "surplus" | "deficit" | "balanced";
  errorMessage?: string;
}

export interface DailyRunwayInputs {
  totalSpendablePool: number;
  spentSoFar: number;
  currentDate?: Date;
}

export interface DailyRunwayBreakdown {
  remainingSpendablePool: number;
  remainingDays: number;
  adaptiveDailyLimit: number;
  isOverBudget: boolean;
  overspendAmount: number;
}

/**
 * Returns dynamic days count for any month in a year.
 * Never assumes or hardcodes 30 days.
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Calculates the remaining days in the month (including today)
 * to provide a real-time spending runway.
 */
export function getRemainingDaysInMonth(date: Date = new Date()): number {
  const daysInMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
  const currentDay = date.getDate();
  return Math.max(1, daysInMonth - currentDay + 1);
}

/**
 * Calculates elapsed days in the month up to current date.
 */
export function getElapsedDaysInMonth(date: Date = new Date()): number {
  return Math.max(1, date.getDate());
}

/**
 * Floating point rounding utility using integer cents (multiply by 100, round, divide by 100)
 * to prevent JavaScript IEEE 754 precision anomalies (e.g., 0.1 + 0.2 !== 0.3).
 */
export function roundToCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Core Financial Calculation Function:
 * Calculates disposable spendable budget, daily spending limits, daily savings rate,
 * and flags deficit states with strict validation.
 */
export function calculateBudgetMetrics(inputs: BudgetInputs): BudgetBreakdown {
  const date = inputs.currentDate || new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Total days in month & remaining days dynamically derived
  const daysInMonth = getDaysInMonth(year, month);
  const currentDay = date.getDate();
  // Safe remaining days preventing division by zero or negative days
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);

  const fixed = inputs.fixedExpenses || 0;

  // Integer cents precision
  const incomeCents = Math.round((inputs.monthlyIncome || 0) * 100);
  const savingsCents = Math.round((inputs.savingsGoal || 0) * 100);
  const fixedCents = Math.round(fixed * 100);

  const spendablePoolCents = incomeCents - savingsCents - fixedCents;
  const totalSpendablePool = spendablePoolCents / 100;

  // Over-budget / Deficit detection
  const isDeficit = (savingsCents + fixedCents) > incomeCents;
  const isSurplus = spendablePoolCents > 0;
  const status: "surplus" | "deficit" | "balanced" = isDeficit 
    ? "deficit" 
    : isSurplus 
    ? "surplus" 
    : "balanced";

  const errorMessage = isDeficit
    ? "Budget Deficit: savings goal exceeds available income"
    : undefined;

  // Daily spend limit: remaining spendable pool distributed over remaining days
  // Prevent division by zero if remainingDays <= 0
  const dailySpendLimit = remainingDays > 0
    ? roundToCurrency(totalSpendablePool / remainingDays)
    : 0;

  // Daily savings target: purely informational rate across entire period, never spendable limit
  const dailySavingsTarget = daysInMonth > 0
    ? roundToCurrency((inputs.savingsGoal || 0) / daysInMonth)
    : 0;

  return {
    totalSpendablePool: roundToCurrency(totalSpendablePool),
    dailySpendLimit,
    dailySavingsTarget,
    daysInMonth,
    remainingDays,
    status,
    ...(errorMessage ? { errorMessage } : {})
  };
}

/**
 * Adaptive daily spending runway given money already spent during the current period.
 */
export function calculateAdaptiveDailyRunway(inputs: DailyRunwayInputs): DailyRunwayBreakdown {
  const date = inputs.currentDate || new Date();
  const remainingDays = getRemainingDaysInMonth(date);

  const poolCents = Math.round((inputs.totalSpendablePool || 0) * 100);
  const spentCents = Math.round((inputs.spentSoFar || 0) * 100);
  const remainingCents = poolCents - spentCents;
  const remainingSpendablePool = roundToCurrency(remainingCents / 100);

  const isOverBudget = remainingCents < 0;
  const overspendAmount = isOverBudget ? roundToCurrency(Math.abs(remainingSpendablePool)) : 0;
  
  // Real-time daily runway remaining
  const adaptiveDailyLimit = !isOverBudget && remainingDays > 0
    ? roundToCurrency(remainingSpendablePool / remainingDays)
    : 0;

  return {
    remainingSpendablePool,
    remainingDays,
    adaptiveDailyLimit,
    isOverBudget,
    overspendAmount
  };
}
