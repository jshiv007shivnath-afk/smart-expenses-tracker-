/**
 * Client PostgreSQL (Cloud SQL) API integration module
 */

export interface PostgresDbStatus {
  status: string;
  database: string;
  instance: string;
  region: string;
  connected: boolean;
}

export interface PostgresUserProfile {
  id: number;
  uid: string;
  email: string;
  budget: number | null;
  currency: string | null;
  currencySymbol: string | null;
  balance: number | null;
  isPremium: boolean | null;
  createdAt: string | null;
}

export interface PostgresTransactionRecord {
  id: number;
  userId: number;
  type: 'topup' | 'send' | 'withdraw' | 'expense' | 'income';
  amount: number;
  date: string;
  time?: string | null;
  title?: string | null;
  subtitle?: string | null;
  note?: string | null;
  category?: string | null;
  createdAt?: string | null;
}

const getHeaders = (uid: string) => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${uid}`,
  };
};

export async function fetchPostgresStatus(): Promise<PostgresDbStatus> {
  try {
    const res = await fetch('/api/db/status');
    if (!res.ok) {
      throw new Error(`DB Status returned ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error('Failed to get PostgreSQL status:', err);
    return {
      status: 'error',
      database: 'PostgreSQL (Cloud SQL)',
      instance: 'ai-studio-c9c229b3',
      region: 'asia-southeast1',
      connected: false,
    };
  }
}

export async function fetchPostgresUserProfile(uid: string): Promise<PostgresUserProfile | null> {
  try {
    const res = await fetch('/api/user/profile', {
      method: 'GET',
      headers: getHeaders(uid),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to load profile: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Error loading PostgreSQL user profile:', err);
    return null;
  }
}

export async function updatePostgresUserProfile(
  uid: string,
  profile: { budget?: number; balance?: number; currency?: string; currencySymbol?: string }
): Promise<PostgresUserProfile | null> {
  try {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: getHeaders(uid),
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      throw new Error(`Failed to update profile: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Error updating PostgreSQL user profile:', err);
    return null;
  }
}

export async function fetchPostgresTransactions(uid: string): Promise<PostgresTransactionRecord[]> {
  try {
    const res = await fetch('/api/transactions?limit=100', {
      method: 'GET',
      headers: getHeaders(uid),
    });
    if (!res.ok) {
      throw new Error(`Failed to load transactions: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Error loading PostgreSQL transactions:', err);
    return [];
  }
}

export async function createPostgresTransaction(
  uid: string,
  tx: {
    type: 'topup' | 'send' | 'withdraw' | 'expense' | 'income';
    amount: number;
    title?: string;
    subtitle?: string;
    category?: string;
    note?: string;
    date?: string;
    time?: string;
  }
): Promise<{ transaction: PostgresTransactionRecord; newBalance: number } | null> {
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: getHeaders(uid),
      body: JSON.stringify(tx),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed to create transaction: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Error creating PostgreSQL transaction:', err);
    return null;
  }
}

export async function deletePostgresTransaction(uid: string, txId: number | string): Promise<boolean> {
  try {
    const res = await fetch(`/api/transactions/${txId}`, {
      method: 'DELETE',
      headers: getHeaders(uid),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error deleting PostgreSQL transaction:', err);
    return false;
  }
}
