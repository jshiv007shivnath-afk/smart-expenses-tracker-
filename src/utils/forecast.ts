export const getCurrentMonthDaysInfo = () => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  return { daysInMonth, currentDay };
};

export const calculateForecast = (transactions: any[], monthlyBudget: number) => {
  const { daysInMonth, currentDay } = getCurrentMonthDaysInfo();
  const spent = transactions.reduce((sum: number, t: any) => sum + (t.type === 'expense' ? t.amount : 0), 0);
  const projected = currentDay === 0 ? 0 : (spent / currentDay) * daysInMonth;
  return { spent, projected };
};
