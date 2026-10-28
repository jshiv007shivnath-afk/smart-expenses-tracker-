import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Plus, Users, UserPlus, Check, Trash2,
  DollarSign, ArrowUpRight, ArrowDownLeft, Share2, Copy,
  Receipt, ArrowRight, UserCheck, ShieldCheck, Sparkles, X,
  CheckCircle2, RefreshCw
} from 'lucide-react';

export interface GroupMember {
  id: string;
  name: string;
  avatarBg?: string;
}

export interface GroupExpenseItem {
  id: string;
  title: string;
  amount: number;
  paidByMemberId: string;
  splitMemberIds: string[];
  date: string;
  category?: string;
}

export interface Group {
  id: string;
  name: string;
  category: 'Trip' | 'Home' | 'Event' | 'Other';
  members: GroupMember[];
  expenses: GroupExpenseItem[];
}

interface GroupExpenseScreenProps {
  onBack: () => void;
  currencySymbol: string;
  onAddTransactionToMain?: (tx: { amount: number; title: string; subtitle: string; category: string; date: string }) => void;
}

export const GroupExpenseScreen: React.FC<GroupExpenseScreenProps> = ({
  onBack,
  currencySymbol,
  onAddTransactionToMain
}) => {
  // Saved groups in state / localStorage
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('smart-expenses-splitwise-groups');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'g1',
        name: 'Flatmates / Room Rent',
        category: 'Home',
        members: [
          { id: 'you', name: 'You (Me)' },
          { id: 'm1', name: 'Rahul' },
          { id: 'm2', name: 'Priya' }
        ],
        expenses: [
          {
            id: 'e1',
            title: 'WiFi & Broadband Bill',
            amount: 60,
            paidByMemberId: 'you',
            splitMemberIds: ['you', 'm1', 'm2'],
            date: new Date().toISOString().split('T')[0],
            category: 'Bills'
          },
          {
            id: 'e2',
            title: 'Groceries & Milk',
            amount: 90,
            paidByMemberId: 'm1',
            splitMemberIds: ['you', 'm1', 'm2'],
            date: new Date().toISOString().split('T')[0],
            category: 'Food'
          }
        ]
      }
    ];
  });

  const [activeGroupId, setActiveGroupId] = useState<string | null>(groups[0]?.id || null);
  const [activeTab, setActiveTab] = useState<'balances' | 'expenses'>('balances');

  // Modals
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [copySuccessText, setCopySuccessText] = useState<string | null>(null);

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState<'Trip' | 'Home' | 'Event' | 'Other'>('Trip');
  const [newMemberInput, setNewMemberInput] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>(['Rahul', 'Priya']);

  // New Group Expense Form State
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('you');
  const [expSelectedMembers, setExpSelectedMembers] = useState<string[]>([]);

  // Settle Up State
  const [settlePayerId, setSettlePayerId] = useState('m1');
  const [settleReceiverId, setSettleReceiverId] = useState('you');
  const [settleAmount, setSettleAmount] = useState('');

  const saveGroupsToStorage = (updated: Group[]) => {
    setGroups(updated);
    localStorage.setItem('smart-expenses-splitwise-groups', JSON.stringify(updated));
  };

  const currentGroup = groups.find(g => g.id === activeGroupId);

  // Calculate Net Balances for active group
  const getGroupBalances = (group: Group) => {
    // memberId -> net Balance (positive means they are owed money, negative means they owe money)
    const balances: Record<string, number> = {};
    group.members.forEach(m => { balances[m.id] = 0; });

    group.expenses.forEach(exp => {
      const payerId = exp.paidByMemberId;
      const amount = exp.amount;
      const splitters = exp.splitMemberIds.length > 0 ? exp.splitMemberIds : group.members.map(m => m.id);
      const splitAmount = amount / splitters.length;

      // Payer gets credited total amount
      if (balances[payerId] !== undefined) {
        balances[payerId] += amount;
      }

      // Everyone in split pays their portion
      splitters.forEach(id => {
        if (balances[id] !== undefined) {
          balances[id] -= splitAmount;
        }
      });
    });

    return balances;
  };

  // Generate pairwise debt list (who owes whom)
  const calculateWhoOwesWhom = (group: Group) => {
    const net = getGroupBalances(group);
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    Object.entries(net).forEach(([id, bal]) => {
      if (bal < -0.01) debtors.push({ id, amount: -bal });
      else if (bal > 0.01) creditors.push({ id, amount: bal });
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debts: { debtorId: string; creditorId: string; amount: number }[] = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = Math.min(debtor.amount, creditor.amount);

      debts.push({
        debtorId: debtor.id,
        creditorId: creditor.id,
        amount: Number(amount.toFixed(2))
      });

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return debts;
  };

  // Create Group Handler
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const memberObjs: GroupMember[] = [
      { id: 'you', name: 'You (Me)' },
      ...newGroupMembers.filter(m => m.trim().length > 0).map((m, idx) => ({
        id: `m_${Date.now()}_${idx}`,
        name: m.trim()
      }))
    ];

    const newGroup: Group = {
      id: `g_${Date.now()}`,
      name: newGroupName.trim(),
      category: newGroupCategory,
      members: memberObjs,
      expenses: []
    };

    const updated = [...groups, newGroup];
    saveGroupsToStorage(updated);
    setActiveGroupId(newGroup.id);
    setIsCreateGroupOpen(false);
    setNewGroupName('');
    setNewGroupMembers(['Rahul', 'Priya']);
  };

  // Add Member to creation list
  const handleAddMemberToForm = () => {
    if (newMemberInput.trim()) {
      setNewGroupMembers([...newGroupMembers, newMemberInput.trim()]);
      setNewMemberInput('');
    }
  };

  // Add Group Expense Handler
  const handleAddGroupExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !expTitle.trim() || !expAmount || isNaN(Number(expAmount))) return;

    const numAmount = parseFloat(expAmount);
    const splitIds = expSelectedMembers.length > 0 
      ? expSelectedMembers 
      : currentGroup.members.map(m => m.id);

    const newExp: GroupExpenseItem = {
      id: `e_${Date.now()}`,
      title: expTitle.trim(),
      amount: numAmount,
      paidByMemberId: expPaidBy,
      splitMemberIds: splitIds,
      date: new Date().toISOString().split('T')[0],
      category: 'General'
    };

    const updatedGroups = groups.map(g => {
      if (g.id === currentGroup.id) {
        return {
          ...g,
          expenses: [newExp, ...g.expenses]
        };
      }
      return g;
    });

    saveGroupsToStorage(updatedGroups);

    // If "You" paid, or "You" are part of split, log your personal share to main expenses if requested
    if (onAddTransactionToMain && expPaidBy === 'you') {
      const myShare = numAmount / splitIds.length;
      onAddTransactionToMain({
        amount: myShare,
        title: `${expTitle.trim()} (Group)`,
        subtitle: `Split with ${currentGroup.name}`,
        category: 'Shopping',
        date: new Date().toISOString().split('T')[0]
      });
    }

    setIsAddExpenseOpen(false);
    setExpTitle('');
    setExpAmount('');
  };

  // Settle Up Handler
  const handleSettleUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !settleAmount || isNaN(Number(settleAmount)) || settlePayerId === settleReceiverId) return;

    const numAmount = parseFloat(settleAmount);
    const payerName = currentGroup.members.find(m => m.id === settlePayerId)?.name || 'Member';
    const receiverName = currentGroup.members.find(m => m.id === settleReceiverId)?.name || 'Member';

    const settlementExp: GroupExpenseItem = {
      id: `s_${Date.now()}`,
      title: `Settlement: ${payerName} → ${receiverName}`,
      amount: numAmount,
      paidByMemberId: settlePayerId,
      splitMemberIds: [settleReceiverId],
      date: new Date().toISOString().split('T')[0],
      category: 'Settlement'
    };

    const updatedGroups = groups.map(g => {
      if (g.id === currentGroup.id) {
        return {
          ...g,
          expenses: [settlementExp, ...g.expenses]
        };
      }
      return g;
    });

    saveGroupsToStorage(updatedGroups);
    setIsSettleUpOpen(false);
    setSettleAmount('');
  };

  // Delete Group Expense
  const handleDeleteGroupExpense = (expId: string) => {
    if (!currentGroup) return;
    const updated = groups.map(g => {
      if (g.id === currentGroup.id) {
        return {
          ...g,
          expenses: g.expenses.filter(e => e.id !== expId)
        };
      }
      return g;
    });
    saveGroupsToStorage(updated);
  };

  // Share summary
  const handleShareSummary = () => {
    if (!currentGroup) return;
    const debts = calculateWhoOwesWhom(currentGroup);
    let summaryText = `📊 ${currentGroup.name} Expense Summary:\n\n`;

    if (debts.length === 0) {
      summaryText += `All expenses settled up! No outstanding balances.`;
    } else {
      debts.forEach(d => {
        const debtorName = currentGroup.members.find(m => m.id === d.debtorId)?.name || 'Someone';
        const creditorName = currentGroup.members.find(m => m.id === d.creditorId)?.name || 'Someone';
        summaryText += `• ${debtorName} owes ${creditorName}: ${currencySymbol}${d.amount.toFixed(2)}\n`;
      });
    }

    summaryText += `\nShared via Smart Expenses Splitwise`;

    navigator.clipboard.writeText(summaryText);
    setCopySuccessText('Summary copied to clipboard!');
    setTimeout(() => setCopySuccessText(null), 2500);
  };

  const getMemberName = (group: Group, id: string) => {
    const found = group.members.find(m => m.id === id);
    return found ? found.name : 'Unknown';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 w-full h-full bg-[#F2F2F7] dark:bg-black flex flex-col relative overflow-hidden pb-28"
    >
      {/* Header */}
      <div className="pt-14 px-6 flex justify-between items-center mb-4">
        <motion.button 
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onBack} 
          className="w-10 h-10 bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
        >
          <ChevronLeft size={22} className="text-gray-900 dark:text-white" />
        </motion.button>

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-[#34C759] text-white flex items-center justify-center font-bold shadow-sm">
            <Users size={16} />
          </div>
          <h1 className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight">Splitwise Groups</h1>
        </div>

        <button 
          onClick={() => setIsCreateGroupOpen(true)}
          className="w-10 h-10 bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111] rounded-full flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Horizontal Group Selector Pills */}
      <div className="px-6 mb-4 overflow-x-auto hide-scrollbar flex space-x-3 py-1">
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroupId(g.id)}
            className={`px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-2 cursor-pointer shrink-0 ${
              activeGroupId === g.id
                ? 'bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111] shadow-sm scale-105'
                : 'bg-white/70 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            <Users size={14} />
            <span>{g.name}</span>
          </button>
        ))}
        <button
          onClick={() => setIsCreateGroupOpen(true)}
          className="px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap bg-white/40 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/20 text-gray-500 dark:text-gray-400 flex items-center space-x-1 shrink-0"
        >
          <Plus size={14} />
          <span>New Group</span>
        </button>
      </div>

      {/* Main Content Area */}
      {currentGroup ? (
        <div className="px-6 flex-1 overflow-y-auto space-y-6">
          {/* Group Header Card */}
          <div className="liquid-glass-card rounded-[28px] p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Group</span>
                <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white leading-tight">{currentGroup.name}</h2>
              </div>
              <button 
                onClick={handleShareSummary}
                className="p-2.5 rounded-full bg-white/80 dark:bg-white/10 text-zinc-800 dark:text-white shadow-sm hover:scale-105 transition-transform flex items-center space-x-1.5 px-3"
              >
                <Share2 size={15} />
                <span className="text-xs font-bold">Share</span>
              </button>
            </div>

            {/* Members Avatars */}
            <div className="flex items-center space-x-2 pt-2 border-t border-gray-200/60 dark:border-white/10">
              <span className="text-xs text-zinc-500 font-semibold mr-1">Members ({currentGroup.members.length}):</span>
              <div className="flex -space-x-2">
                {currentGroup.members.map((m, idx) => (
                  <div 
                    key={m.id}
                    className="w-7 h-7 rounded-full bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111] text-xs font-bold flex items-center justify-center border-2 border-white dark:border-black"
                  >
                    {m.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Row: Add Expense & Settle Up */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setExpSelectedMembers(currentGroup.members.map(m => m.id));
                setIsAddExpenseOpen(true);
              }}
              className="h-13 bg-[#34C759] text-white font-bold text-[14px] rounded-2xl flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
            >
              <Plus size={18} />
              <span>Add Group Expense</span>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsSettleUpOpen(true)}
              className="h-13 bg-[#0D2111] dark:bg-[#C5F531] text-[#C5F531] dark:text-[#0D2111] font-bold text-[14px] rounded-2xl flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
            >
              <CheckCircle2 size={18} />
              <span>Settle Up</span>
            </motion.button>
          </div>

          {/* Tabs: Balances vs Expense History */}
          <div className="flex bg-white/50 dark:bg-white/5 p-1 rounded-2xl border border-gray-200/50 dark:border-white/10">
            <button
              onClick={() => setActiveTab('balances')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'balances'
                  ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Balances Summary
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'expenses'
                  ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Expense History ({currentGroup.expenses.length})
            </button>
          </div>

          {/* Tab 1: Balances & Who Owes Whom */}
          {activeTab === 'balances' && (
            <div className="space-y-4">
              <div className="liquid-glass-card rounded-[28px] p-5 shadow-sm space-y-3">
                <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider">
                  Settlement Breakdown
                </h3>

                {calculateWhoOwesWhom(currentGroup).length === 0 ? (
                  <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                    <CheckCircle2 size={32} className="mx-auto text-[#34C759] mb-2" />
                    <p className="font-bold text-[15px] text-gray-900 dark:text-white">All Settled Up!</p>
                    <p className="text-xs mt-1">No pending debts between group members.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {calculateWhoOwesWhom(currentGroup).map((debt, i) => {
                      const debtorName = getMemberName(currentGroup, debt.debtorId);
                      const creditorName = getMemberName(currentGroup, debt.creditorId);
                      const isYouDebtor = debt.debtorId === 'you';
                      const isYouCreditor = debt.creditorId === 'you';

                      return (
                        <div 
                          key={i} 
                          className="bg-white/80 dark:bg-white/5 p-3.5 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-white/5 shadow-xs"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                              isYouCreditor 
                                ? 'bg-[#34C759]/20 text-[#34C759]' 
                                : isYouDebtor 
                                ? 'bg-red-500/20 text-red-500' 
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}>
                              <ArrowRight size={16} />
                            </div>
                            <div>
                              <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug">
                                <span className={isYouDebtor ? 'text-red-500' : ''}>{debtorName}</span> owes <span className={isYouCreditor ? 'text-[#34C759]' : ''}>{creditorName}</span>
                              </p>
                              <p className="text-xs text-gray-500 font-medium">Split repayment</p>
                            </div>
                          </div>

                          <span className={`text-[15px] font-black ${
                            isYouCreditor ? 'text-[#34C759]' : isYouDebtor ? 'text-red-500' : 'text-gray-900 dark:text-white'
                          }`}>
                            {currencySymbol}{debt.amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Expense History */}
          {activeTab === 'expenses' && (
            <div className="space-y-3">
              {currentGroup.expenses.length === 0 ? (
                <div className="liquid-glass-card rounded-[28px] p-8 text-center text-gray-500">
                  <Receipt size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="font-bold text-gray-900 dark:text-white">No Group Expenses Yet</p>
                  <p className="text-xs mt-1">Tap 'Add Group Expense' above to log bill splits.</p>
                </div>
              ) : (
                currentGroup.expenses.map((exp) => {
                  const payerName = getMemberName(currentGroup, exp.paidByMemberId);
                  return (
                    <div 
                      key={exp.id}
                      className="liquid-glass-card p-4 rounded-[24px] flex items-center justify-between shadow-xs"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-11 h-11 bg-white/80 dark:bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                          <Receipt size={20} className="text-[#34C759]" />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">{exp.title}</h4>
                          <p className="text-[12px] text-gray-500 font-medium mt-0.5">
                            Paid by <span className="font-bold text-gray-800 dark:text-gray-200">{payerName}</span> • {exp.splitMemberIds.length} members
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[15px] font-extrabold text-gray-900 dark:text-white">
                          {currencySymbol}{exp.amount.toFixed(2)}
                        </span>
                        <button 
                          onClick={() => handleDeleteGroupExpense(exp.id)}
                          className="text-gray-400 hover:text-red-500 p-1.5 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-6 text-center py-12 text-gray-500">
          <Users size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="font-bold text-gray-900 dark:text-white text-lg">No Group Selected</p>
          <p className="text-xs mt-1">Create a group to split expenses with friends.</p>
          <button
            onClick={() => setIsCreateGroupOpen(true)}
            className="mt-4 px-6 py-3 bg-[#34C759] text-white font-bold rounded-full text-sm shadow-md"
          >
            Create First Group
          </button>
        </div>
      )}

      {/* Copy notification toast */}
      <AnimatePresence>
        {copySuccessText && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-black text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg z-[100] flex items-center space-x-2"
          >
            <Check size={14} className="text-[#34C759]" />
            <span>{copySuccessText}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 1: Create Group Modal */}
      <AnimatePresence>
        {isCreateGroupOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
                <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">Create New Group</h2>
                <button onClick={() => setIsCreateGroupOpen(false)} className="text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">GROUP NAME</label>
                  <input 
                    type="text"
                    placeholder="e.g. Goa Trip, Flatmates, Dinner"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">ADD MEMBERS</label>
                  <div className="flex space-x-2 mb-2">
                    <input 
                      type="text"
                      placeholder="Friend's Name"
                      value={newMemberInput}
                      onChange={(e) => setNewMemberInput(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 font-bold text-gray-900 dark:text-white text-sm"
                    />
                    <button 
                      type="button"
                      onClick={handleAddMemberToForm}
                      className="px-4 bg-[#0D2111] dark:bg-[#C5F531] text-white dark:text-[#0D2111] font-bold rounded-2xl text-xs"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="bg-[#C5F531]/20 text-[#0D2111] dark:text-[#C5F531] font-bold text-xs px-2.5 py-1 rounded-full">
                      You (Me)
                    </span>
                    {newGroupMembers.map((m, idx) => (
                      <span key={idx} className="bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 font-bold text-xs px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <span>{m}</span>
                        <button type="button" onClick={() => setNewGroupMembers(newGroupMembers.filter((_, i) => i !== idx))}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full h-13 bg-[#34C759] text-white font-bold rounded-full shadow-lg mt-4"
                >
                  Create Group
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 2: Add Group Expense Modal */}
      <AnimatePresence>
        {isAddExpenseOpen && currentGroup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
                <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">Add Expense to {currentGroup.name}</h2>
                <button onClick={() => setIsAddExpenseOpen(false)} className="text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddGroupExpense} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">EXPENSE DESCRIPTION</label>
                  <input 
                    type="text"
                    placeholder="e.g. Dinner bill, Taxi fare, Hotel room"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">TOTAL AMOUNT</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-900 dark:text-white text-lg">{currencySymbol}</span>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-3 font-extrabold text-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">PAID BY</label>
                  <select 
                    value={expPaidBy}
                    onChange={(e) => setExpPaidBy(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 font-bold text-gray-900 dark:text-white text-sm"
                  >
                    {currentGroup.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full h-13 bg-[#34C759] text-white font-bold rounded-full shadow-lg mt-4"
                >
                  Save Group Expense
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 3: Settle Up Modal */}
      <AnimatePresence>
        {isSettleUpOpen && currentGroup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white dark:bg-[#1C1C1E] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
                <h2 className="text-[18px] font-bold text-gray-900 dark:text-white">Record Settlement</h2>
                <button onClick={() => setIsSettleUpOpen(false)} className="text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSettleUp} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">WHO PAID?</label>
                    <select 
                      value={settlePayerId}
                      onChange={(e) => setSettlePayerId(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-3 font-bold text-gray-900 dark:text-white text-xs"
                    >
                      {currentGroup.members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">PAID TO WHOM?</label>
                    <select 
                      value={settleReceiverId}
                      onChange={(e) => setSettleReceiverId(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-3 font-bold text-gray-900 dark:text-white text-xs"
                    >
                      {currentGroup.members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">SETTLEMENT AMOUNT</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-900 dark:text-white text-lg">{currencySymbol}</span>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-3 font-extrabold text-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C5F531]"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full h-13 bg-[#34C759] text-white font-bold rounded-full shadow-lg mt-4"
                >
                  Confirm Settlement
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
