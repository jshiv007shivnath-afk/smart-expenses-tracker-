import { doc, getDoc, getDocFromCache, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserData {
  balance: number;
  budget: number;
  dailyLimit: number;
  dailySpendingNote?: string;
  currency: string;
  currencySymbol: string;
  transactions: any[];
  workspaceItems: any[];
  monthlyHistory: any[];
  lastMonth: string;
  hasCompletedSetup: boolean;
  isPremium?: boolean;
}

export const loadUserData = async (userId: string): Promise<UserData | null> => {
  const docRef = doc(db, 'users', userId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserData;
    }
  } catch (error: any) {
    // If client is offline, attempt to load from IndexedDB cache
    if (error?.code === 'unavailable' || (error?.message && error.message.toLowerCase().includes('offline'))) {
      try {
        const cacheSnap = await getDocFromCache(docRef);
        if (cacheSnap.exists()) {
          console.log('Loaded user data from offline cache');
          return cacheSnap.data() as UserData;
        }
      } catch (cacheError) {
        console.warn('Could not load user data from offline cache:', cacheError);
      }
    } else {
      console.warn('Error loading user data:', error);
    }
  }
  return null;
};

export const saveUserData = async (userId: string, data: Partial<UserData>) => {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, data, { merge: true });
  } catch (error: any) {
    if (error?.code === 'unavailable' || (error?.message && error.message.toLowerCase().includes('offline'))) {
      console.warn('Offline mode: Changes stored locally and will sync when reconnected.');
    } else {
      console.warn('Error saving user data:', error);
    }
  }
};
