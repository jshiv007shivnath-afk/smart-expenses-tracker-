import {
  calculateBudgetMetrics,
  calculateAdaptiveDailyRunway,
  getDaysInMonth,
  getRemainingDaysInMonth,
  getElapsedDaysInMonth,
  roundToCurrency,
} from '../src/utils/financialCalculations.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    console.error(`❌ Assertion Failed: ${message} (Expected: ${expected}, Actual: ${actual})`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

console.log('--- Testing Dynamic Days in Month Calculation ---');
// February non-leap year (2025)
assertEquals(getDaysInMonth(2025, 1), 28, 'Feb 2025 has 28 days');
// February leap year (2024)
assertEquals(getDaysInMonth(2024, 1), 29, 'Feb 2024 has 29 days');
// March has 31 days
assertEquals(getDaysInMonth(2026, 2), 31, 'Mar 2026 has 31 days');
// April has 30 days
assertEquals(getDaysInMonth(2026, 3), 30, 'Apr 2026 has 30 days');

console.log('\n--- Testing Remaining Days in Month Runway ---');
// On 15th March of 31-day month: remaining = 31 - 15 + 1 = 17 days
const mar15 = new Date(2026, 2, 15);
assertEquals(getRemainingDaysInMonth(mar15), 17, 'Mar 15 has 17 remaining days');
// On last day of month (March 31): remaining = 31 - 31 + 1 = 1 day
const mar31 = new Date(2026, 2, 31);
assertEquals(getRemainingDaysInMonth(mar31), 1, 'Mar 31 has 1 remaining day');
// On first day of month (March 1): remaining = 31 - 1 + 1 = 31 days
const mar1 = new Date(2026, 2, 1);
assertEquals(getRemainingDaysInMonth(mar1), 31, 'Mar 1 has 31 remaining days');

console.log('\n--- Testing Floating Point Precision ---');
// 0.1 + 0.2 floating point check
assertEquals(roundToCurrency(0.1 + 0.2), 0.3, '0.1 + 0.2 rounds cleanly to 0.3');
// Precision with currency cents
const precisionMetrics = calculateBudgetMetrics({
  monthlyIncome: 1000.1,
  savingsGoal: 300.2,
  fixedExpenses: 100.0,
  currentDate: new Date(2026, 3, 1), // April: 30 days, day 1: 30 remaining days
});
// totalSpendablePool = 1000.1 - 300.2 - 100 = 599.9
assertEquals(precisionMetrics.totalSpendablePool, 599.9, 'Spendable pool with decimal inputs is exactly 599.9');
assertEquals(precisionMetrics.dailySpendLimit, 20.0, 'Daily spend limit 599.9 / 30 = 20.00');
assertEquals(precisionMetrics.dailySavingsTarget, 10.01, 'Daily savings target 300.2 / 30 = 10.01');
assertEquals(precisionMetrics.status, 'surplus', 'Status is surplus');

console.log('\n--- Testing Budget Deficit Handling ---');
// savings_goal + fixed_expenses > income
const deficitMetrics = calculateBudgetMetrics({
  monthlyIncome: 1000,
  savingsGoal: 800,
  fixedExpenses: 300,
  currentDate: new Date(2026, 3, 15), // 16 remaining days
});
assertEquals(deficitMetrics.totalSpendablePool, -100, 'Deficit totalSpendablePool is -100');
assertEquals(deficitMetrics.status, 'deficit', 'Status is deficit');
assertEquals(
  deficitMetrics.errorMessage,
  'Budget Deficit: savings goal exceeds available income',
  'Error message matches specification exactly'
);
assertEquals(deficitMetrics.dailySpendLimit, -6.25, 'Daily spend limit properly reflects negative runway (-100 / 16 = -6.25)');

console.log('\n--- Testing Balanced Budget ---');
const balancedMetrics = calculateBudgetMetrics({
  monthlyIncome: 1500,
  savingsGoal: 500,
  fixedExpenses: 1000,
  currentDate: new Date(2026, 3, 1),
});
assertEquals(balancedMetrics.totalSpendablePool, 0, 'Balanced totalSpendablePool is 0');
assertEquals(balancedMetrics.status, 'balanced', 'Status is balanced');
assertEquals(balancedMetrics.dailySpendLimit, 0, 'Daily spend limit is 0');
assertEquals(balancedMetrics.errorMessage, undefined, 'No error message for balanced budget');

console.log('\n--- Testing Adaptive Daily Spending Runway ---');
const runwayMetrics = calculateAdaptiveDailyRunway({
  totalSpendablePool: 600,
  spentSoFar: 200, // 400 remaining
  currentDate: new Date(2026, 3, 11), // April: 30 - 11 + 1 = 20 remaining days
});
assertEquals(runwayMetrics.remainingSpendablePool, 400, 'Remaining pool is 400');
assertEquals(runwayMetrics.remainingDays, 20, 'Remaining days is 20');
assertEquals(runwayMetrics.adaptiveDailyLimit, 20, 'Adaptive daily limit is 400 / 20 = 20/day');
assertEquals(runwayMetrics.isOverBudget, false, 'Not over budget');

// Overspent runway
const overspentRunway = calculateAdaptiveDailyRunway({
  totalSpendablePool: 500,
  spentSoFar: 550,
  currentDate: new Date(2026, 3, 11),
});
assertEquals(overspentRunway.remainingSpendablePool, -50, 'Remaining pool is -50');
assertEquals(overspentRunway.isOverBudget, true, 'isOverBudget is true');
assertEquals(overspentRunway.overspendAmount, 50, 'Overspend amount is 50');
assertEquals(overspentRunway.adaptiveDailyLimit, 0, 'Adaptive limit does not divide negative into daily spend');

console.log('\n🎉 ALL MATHEMATICAL LOGIC TESTS PASSED SUCCESSFULLY!\n');
