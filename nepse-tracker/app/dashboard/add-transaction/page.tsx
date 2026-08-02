'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type TxType = 'BUY' | 'SELL';

interface RecentEntry {
  id: string;
  type: TxType;
  symbol: string;
  qty: number;
  price: number;
  total: number;
  date: string;
  remarks?: string;
}

export default function AddTransactionPage() {
  const supabase = createClient();

  const [type, setType] = useState<TxType>('BUY');
  const [symbol, setSymbol] = useState('NABIL');
  const [quantity, setQuantity] = useState<number | ''>(10);
  const [price, setPrice] = useState<number | ''>(100);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // CGT Automation States (Only for SELL)
  const [wacc, setWacc] = useState<number | ''>('');
  const [isLongTerm, setIsLongTerm] = useState(false); // true = > 365 days (5%), false = < 365 days (7.5%)

  // Manual Overrides
  const [overrideBrokerComm, setOverrideBrokerComm] = useState<string>('');
  const [overrideCGT, setOverrideCGT] = useState<string>('');
  const [overrideDPFee, setOverrideDPFee] = useState<string>('');

  // Recent Entries State & Loading/Error
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch recent transactions from Supabase on mount
  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoadingEntries(true);
        setError(null);

        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
          setError('You must be logged in to view your portfolio.');
          setLoadingEntries(false);
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from('portfolio')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(10);

        if (fetchErr) throw fetchErr;

        if (data) {
          const mapped: RecentEntry[] = data.map((item) => ({
            id: item.id?.toString() || Math.random().toString(),
            type: item.transaction_type as TxType,
            symbol: item.symbol,
            qty: Number(item.qty),
            price: Number(item.price),
            total: Number(item.net_amount || item.total_invested || item.total_received || 0),
            date: item.date,
            remarks: item.remarks,
          }));
          setRecentEntries(mapped);
        }
      } catch (err: any) {
        console.error('Error fetching transactions:', err.message);
        setError(err.message);
      } finally {
        setLoadingEntries(false);
      }
    }

    fetchTransactions();
  }, [supabase]);

  // Automated NEPSE Calculation Engine
  const calc = useMemo(() => {
    const qty = Number(quantity) || 0;
    const px = Number(price) || 0;
    const baseAmount = qty * px;

    if (baseAmount <= 0) {
      return {
        baseAmount: 0,
        brokerComm: 0,
        sebonFee: 0,
        dpFee: 0,
        cgt: 0,
        totalFees: 0,
        totalPayable: 0,
        breakevenPrice: 0,
        profitOrLoss: 0
      };
    }

    // 1. NEPSE Tiered Broker Commission
    let calcBrokerComm = 0;
    if (baseAmount <= 50000) {
      calcBrokerComm = Math.max(10, baseAmount * 0.0036);
    } else if (baseAmount <= 500000) {
      calcBrokerComm = baseAmount * 0.0033;
    } else if (baseAmount <= 2000000) {
      calcBrokerComm = baseAmount * 0.0031;
    } else if (baseAmount <= 10000000) {
      calcBrokerComm = baseAmount * 0.0027;
    } else {
      calcBrokerComm = baseAmount * 0.0024;
    }

    const brokerComm = overrideBrokerComm !== '' ? Number(overrideBrokerComm) || 0 : calcBrokerComm;

    // 2. SEBON Fee (0.015%)
    const sebonFee = baseAmount * 0.00015;

    // 3. DP Fee (Flat Rs 25)
    const dpFee = overrideDPFee !== '' ? Number(overrideDPFee) || 0 : 25;

    // 4. Capital Gains Tax (SELL trades only)
    let cgt = 0;
    let profitOrLoss = 0;

    if (type === 'SELL') {
      if (overrideCGT !== '') {
        cgt = Number(overrideCGT) || 0;
      } else {
        // Auto-calculate CGT based on WACC
        const netReceivableBeforeCGT = baseAmount - brokerComm - sebonFee - dpFee;
        const purchaseCost = (Number(wacc) || 0) * qty;
        
        profitOrLoss = netReceivableBeforeCGT - purchaseCost;

        if (profitOrLoss > 0 && Number(wacc) > 0) {
          // NEPSE Law: 5% for holding > 365 days, 7.5% for < 365 days
          const cgtRate = isLongTerm ? 0.05 : 0.075;
          cgt = profitOrLoss * cgtRate;
        }
      }
    }

    const totalFees = brokerComm + sebonFee + dpFee + cgt;
    const totalPayable = type === 'BUY' ? baseAmount + totalFees : baseAmount - totalFees;

    // 5. Breakeven Price Calculation (BUY trades only)
    let breakevenPrice = 0;
    if (type === 'BUY' && qty > 0) {
      const targetNetRec = totalPayable;
      const minCommBreakeven = (targetNetRec + 35) / (qty * (1 - 0.00015));
      const sellBase = qty * minCommBreakeven;

      if (sellBase * 0.0036 <= 10) {
        breakevenPrice = minCommBreakeven;
      } else {
        let rate = 0.0036;
        if (sellBase > 10000000) rate = 0.0024;
        else if (sellBase > 2000000) rate = 0.0027;
        else if (sellBase > 500000) rate = 0.0031;
        else if (sellBase > 50000) rate = 0.0033;

        breakevenPrice = (targetNetRec + 25) / (qty * (1 - rate - 0.00015));
      }
    }

    return {
      baseAmount,
      brokerComm,
      sebonFee,
      dpFee,
      cgt,
      totalFees,
      totalPayable,
      breakevenPrice,
      profitOrLoss
    };
  }, [quantity, price, type, wacc, isLongTerm, overrideBrokerComm, overrideCGT, overrideDPFee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !quantity || !price) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        throw new Error('You must be logged in to add transactions.');
      }

      const payload = {
        symbol: symbol.toUpperCase(),
        transaction_type: type,
        qty: Number(quantity),
        price: Number(price),
        net_amount: calc.totalPayable,
        broker_commission: calc.brokerComm,
        sebon_fee: calc.sebonFee,
        dp_fee: calc.dpFee,
        cgt: calc.cgt,
        date,
        remarks: remarks.trim() || null,
        user_id: user.id,
      };

      const { data, error: insertErr } = await supabase
        .from('portfolio')
        .insert([payload])
        .select();

      if (insertErr) throw insertErr;

      const newEntry: RecentEntry = {
        id: data?.[0]?.id?.toString() || Date.now().toString(),
        type,
        symbol: symbol.toUpperCase(),
        qty: Number(quantity),
        price: Number(price),
        total: calc.totalPayable,
        date,
        remarks,
      };

      setRecentEntries([newEntry, ...recentEntries]);
      setSuccessMessage('Successfully saved transaction and fee breakdown to database!');
      setRemarks('');
      setWacc(''); // Reset WACC
    } catch (err: any) {
      setError(err.message || 'Failed to insert transaction into database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          📝 Trade & Settlement Engine
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Advanced NEPSE calculator with automated 5%/7.5% CGT handling and secure session sync.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono">
          ❌ Error: {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-mono">
          ✅ {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Transaction Form */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Transaction Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Transaction Type
              </label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setType('BUY')}
                  className={`py-2 text-xs font-bold rounded-md transition ${
                    type === 'BUY'
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setType('SELL')}
                  className={`py-2 text-xs font-bold rounded-md transition ${
                    type === 'SELL'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SELL
                </button>
              </div>
            </div>

            {/* Symbol & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Stock Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. NABIL"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="10"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Price & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Execution Price (Rs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="100.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Transaction Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Auto CGT Inputs for SELL */}
            {type === 'SELL' && (
              <div className="p-4 bg-slate-950 border border-amber-900/50 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-500">Capital Gains Tax (CGT) Automation</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">WACC / Purchase Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={wacc}
                      onChange={(e) => setWacc(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Avg Cost per share"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Holding Period</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLongTerm(false)}
                        className={`flex-1 py-2 text-[11px] font-bold rounded transition ${
                          !isLongTerm ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        Short Term (7.5%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLongTerm(true)}
                        className={`flex-1 py-2 text-[11px] font-bold rounded transition ${
                          isLongTerm ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        Long Term (5%)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Remarks / Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Remarks / Notes</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Swing trade accumulation at support level"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Overrides Section */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                ⚙️ Manual Overrides (Optional)
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Override Broker Comm (Rs)</label>
                  <input
                    type="number"
                    value={overrideBrokerComm}
                    onChange={(e) => setOverrideBrokerComm(e.target.value)}
                    placeholder="Auto"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Override CGT (Rs)</label>
                  <input
                    type="number"
                    value={overrideCGT}
                    onChange={(e) => setOverrideCGT(e.target.value)}
                    placeholder="Auto"
                    disabled={type === 'BUY'}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Override DP Fee (Rs)</label>
                  <input
                    type="number"
                    value={overrideDPFee}
                    onChange={(e) => setOverrideDPFee(e.target.value)}
                    placeholder="25"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {submitting ? 'Saving to Database...' : 'Confirm & Save Transaction'}
            </button>
          </form>
        </div>

        {/* Right: Settlement Bill Output */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
              🧾 Settlement Bill
            </h2>

            {/* Key Totals */}
            <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  {type === 'BUY' ? 'Total Payable Amount' : 'Net Receivable Amount'}
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                  Rs {calc.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {type === 'BUY' ? (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Breakeven Price</span>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                    Rs {calc.breakevenPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                calc.profitOrLoss !== 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Est. Profit / Loss</span>
                    <div className={`text-lg font-bold font-mono mt-0.5 ${calc.profitOrLoss > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {calc.profitOrLoss > 0 ? '+' : ''}Rs {calc.profitOrLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Fee Breakdown */}
            <div className="mt-5 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">🔸 Base Amount:</span>
                <span>Rs {calc.baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">🔹 Broker Commission:</span>
                <span>Rs {calc.brokerComm.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">🔹 SEBON Fee (0.015%):</span>
                <span>Rs {calc.sebonFee.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">🔹 DP Fee:</span>
                <span>Rs {calc.dpFee.toFixed(2)}</span>
              </div>

              {type === 'SELL' && (
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">🔹 Capital Gains Tax (CGT):</span>
                  <span>Rs {calc.cgt.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-between font-bold text-slate-200">
                <span>Total Fees & Taxes:</span>
                <span className="text-rose-400">Rs {calc.totalFees.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Entries */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            🕒 Recent Entries (Database Synchronized)
          </h2>
          <span className="text-xs text-slate-500 font-mono">{recentEntries.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loadingEntries ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading recent transactions from database...
                  </td>
                </tr>
              ) : recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                recentEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${e.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{e.symbol}</td>
                    <td className="py-3 px-4 text-right">{e.qty.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">Rs {e.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-bold">
                      Rs {e.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">{e.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}