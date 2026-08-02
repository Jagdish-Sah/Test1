'use client';

import React from 'react';

interface HoldingItem {
  ticker: string;
  units: number;
  wacc: number;
  be: number; // Break-Even price considering sell broker fees & SEBON tax
  ltp: number;
  netReceivable: number;
  pnlAmount: number;
  pnlPercent: number;
  weightage: number;
}

export default function PortfolioPage() {
  // Summary Metrics
  const summary = {
    totalInvested: 24631,
    netReceivable: 22719,
    unrealizedPL: -1912,
    unrealizedPLPercent: -7.76,
  };

  // Mock data matching the total metrics
  // (Replace this with dynamic data fetched from Supabase)
  const holdings: HoldingItem[] = [
    {
      ticker: 'NABIL',
      units: 20,
      wacc: 520.00,
      be: 523.00,
      ltp: 485.00,
      netReceivable: 9651.50,
      pnlAmount: -748.50,
      pnlPercent: -7.20,
      weightage: 42.22,
    },
    {
      ticker: 'CIT',
      units: 4,
      wacc: 2150.00,
      be: 2162.00,
      ltp: 1980.00,
      netReceivable: 7880.40,
      pnlAmount: -719.60,
      pnlPercent: -8.37,
      weightage: 34.91,
    },
    {
      ticker: 'HDL',
      units: 5,
      wacc: 1126.20,
      be: 1132.80,
      ltp: 1045.00,
      netReceivable: 5187.10,
      pnlAmount: -443.90,
      pnlPercent: -7.88,
      weightage: 22.87,
    },
  ];

  const isProfitable = (val: number) => val >= 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          💼 My Portfolio
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Real-time tracking of active equity positions and net exit values.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Invested</span>
          <div className="text-2xl font-bold font-mono text-slate-100">
            Rs {summary.totalInvested.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium">Net Receivable (at LTP)</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            Rs {summary.netReceivable.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium">True Unrealized P/L</span>
          <div className="flex items-baseline justify-between">
            <div className={`text-2xl font-bold font-mono ${isProfitable(summary.unrealizedPL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {summary.unrealizedPL.toLocaleString('en-IN')}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isProfitable(summary.unrealizedPLPercent) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {summary.unrealizedPLPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Active Holdings Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            📋 Active Holdings
          </h2>
          <span className="text-xs text-slate-500 font-mono">{holdings.length} Positions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Ticker</th>
                <th className="py-3.5 px-4 text-right">Units</th>
                <th className="py-3.5 px-4 text-right">WACC</th>
                <th className="py-3.5 px-4 text-right">B.E. Price</th>
                <th className="py-3.5 px-4 text-right">LTP</th>
                <th className="py-3.5 px-4 text-right">P/L %</th>
                <th className="py-3.5 px-4 text-right">Weightage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {holdings.map((h) => {
                const isGain = h.pnlPercent >= 0;
                return (
                  <tr key={h.ticker} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-emerald-400">{h.ticker}</td>
                    <td className="py-3.5 px-4 text-right">{h.units.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right">Rs {h.wacc.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right text-amber-400/90">Rs {h.be.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">Rs {h.ltp.toFixed(2)}</td>
                    <td className={`py-3.5 px-4 text-right font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isGain ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{h.weightage.toFixed(1)}%</span>
                        <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${h.weightage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}