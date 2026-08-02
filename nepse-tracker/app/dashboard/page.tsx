'use client';

import React from 'react';
import PortfolioChart from '@/components/PortfolioChart';

export default function DashboardOverview() {
  // Calculated financial state (Can be dynamically bound to Supabase DB hooks)
  const metrics = {
    lastSync: '2026-07-31 13:05:12 (Nepal Time)',
    portfolioValue: 22880.00,
    activeInvestment: 23793.61,
    todaysChange: 430.00,
    netRealizedPL: -2381.42,
    netRealizedPLPercent: -1.79,
    unrealizedPL: -913.61,
    unrealizedPLPercent: -3.84,
    lifetimePL: -3295.03,
    bestClosedTrade: 'NABIL (+14.2%)',
    capitalDeployed: 157165,
    cashRecycled: 130990,
    netCashFlow: -26175,
    capitalTurnover: 560.5,
    holdings: [
      { symbol: 'NABIL', currentValue: 9200 },
      { symbol: 'CIT', currentValue: 7800 },
      { symbol: 'HDL', currentValue: 5880 },
    ],
  };

  const isProfitable = (val: number) => val >= 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            📊 Market Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Last Market Sync: <span className="text-slate-300 font-mono">{metrics.lastSync}</span>
          </p>
        </div>
      </div>

      {/* 1. Net Worth Snapshot */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          🏦 Net Worth Snapshot
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Current Portfolio Value</span>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              Rs {metrics.portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total Active Investment</span>
            <div className="text-2xl font-bold font-mono text-slate-200">
              Rs {metrics.activeInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Today's Change</span>
            <div className={`text-2xl font-bold font-mono ${isProfitable(metrics.todaysChange) ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfitable(metrics.todaysChange) ? '+' : ''}Rs {metrics.todaysChange.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Profit/Loss Analysis */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          ⚖️ Profit/Loss Analysis
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">💰 Net Realized P/L</span>
            <div className={`text-xl font-bold font-mono ${isProfitable(metrics.netRealizedPL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.netRealizedPL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${isProfitable(metrics.netRealizedPLPercent) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {metrics.netRealizedPLPercent}%
            </span>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">📈 Unrealized P/L</span>
            <div className={`text-xl font-bold font-mono ${isProfitable(metrics.unrealizedPL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.unrealizedPL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${isProfitable(metrics.unrealizedPLPercent) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {metrics.unrealizedPLPercent}%
            </span>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">🏆 Lifetime P/L</span>
            <div className={`text-xl font-bold font-mono ${isProfitable(metrics.lifetimePL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.lifetimePL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">🥇 Best Closed Trade</span>
            <div className="text-lg font-bold font-mono text-amber-400">
              {metrics.bestClosedTrade}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Investment Cycle (Lifetime) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          💼 Investment Cycle (Lifetime)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Total Capital Deployed</span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-1">
              Rs {metrics.capitalDeployed.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Total Cash Recycled</span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-1">
              Rs {metrics.cashRecycled.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Net Cash Flow</span>
            <div className={`text-xl font-bold font-mono mt-1 ${isProfitable(metrics.netCashFlow) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.netCashFlow.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Capital Turnover</span>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
              {metrics.capitalTurnover}%
            </div>
          </div>
        </div>
      </section>

      {/* 4. Portfolio Allocation & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-slate-900/60 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-bold text-slate-300 mb-4">Portfolio Allocation (By Asset)</h3>
          <PortfolioChart holdings={metrics.holdings} />
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              📢 Market Alerts
            </h3>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
              System Normal. No critical market alerts or stop-loss limits triggered for active holdings.
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-500">
            Automated terminal monitor running active scan against NEPSE board updates.
          </div>
        </div>
      </div>
    </div>
  );
}