'use client';

import React, { useState, useMemo } from 'react';

type TxType = 'BUY' | 'SELL';

interface RecentEntry {
  id: string;
  type: TxType;
  symbol: string;
  qty: number;
  price: number;
  total: number;
  date: string;
}

export default function AddTransactionPage() {
  const [type, setType] = useState<TxType>('BUY');
  const [symbol, setSymbol] = useState('NABIL');
  const [quantity, setQuantity] = useState<number | ''>(10);
  const [price, setPrice] = useState<number | ''>(100);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Manual Overrides
  const [overrideBrokerComm, setOverrideBrokerComm] = useState<string>('');
  const [overrideCGT, setOverrideCGT] = useState<string>('');
  const [overrideDPFee, setOverrideDPFee] = useState<string>('');
  const [holdingPeriod, setHoldingPeriod] = useState<'SHORT' | 'LONG'>('SHORT');

  // Recent Entries State
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([
    { id: '1', type: 'BUY', symbol: 'NABIL', qty: 10, price: 100, total: 1035.15, date: '2026-08-02' },
    { id: '2', type: 'BUY', symbol: 'CIT', qty: 4, price: 2150, total: 8628.42, date: '2026-07-28' },
  ]);

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
    if (type === 'SELL') {
      if (overrideCGT !== '') {
        cgt = Number(overrideCGT) || 0;
      }
    }

    const totalFees = brokerComm + sebonFee + dpFee + cgt;
    const totalPayable = type === 'BUY' ? baseAmount + totalFees : baseAmount - totalFees;

    // 5. Breakeven Price Calculation (Solves required selling price to recover buy & sell costs)
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
    };
  }, [quantity, price, type, overrideBrokerComm, overrideCGT, overrideDPFee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !quantity || !price) return;

    const newEntry: RecentEntry = {
      id: Date.now().toString(),
      type,
      symbol: symbol.toUpperCase(),
      qty: Number(quantity),
      price: Number(price),
      total: calc.totalPayable,
      date,
    };

    setRecentEntries([newEntry, ...recentEntries]);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          📝 Trade & Settlement Engine
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Advanced NEPSE calculator with automated CGT and holding period analysis.
        </p>
      </div>

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
                    className="w-full bg-slate-950 border border-slate-800 rounded border-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded border-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Override DP Fee (Rs)</label>
                  <input
                    type="number"
                    value={overrideDPFee}
                    onChange={(e) => setOverrideDPFee(e.target.value)}
                    placeholder="25"
                    className="w-full bg-slate-950 border border-slate-800 rounded border-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-emerald-500/10"
            >
              Confirm & Save Transaction
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

              {type === 'BUY' && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Breakeven Price</span>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                    Rs {calc.breakevenPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
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
            🕒 Recent Entries
          </h2>
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
              {recentEntries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${e.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-400">{e.symbol}</td>
                  <td className="py-3 px-4 text-right">{e.qty}</td>
                  <td className="py-3 px-4 text-right">Rs {e.price.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-bold">
                    Rs {e.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">{e.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}