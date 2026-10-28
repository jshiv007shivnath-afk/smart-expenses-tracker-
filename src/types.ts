export type Transaction = {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  title: string;
  categoryId: string;
  time: string;
  occurredAt: string;
  isConfirmed: boolean;
};

export type User = {
  name: string;
  monthlyBudget: number;
  locale: string;
  currency: string;
};
