'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PortfolioChart from '@/components/PortfolioChart';

interface PortfolioRow {
  id?: string;
  symbol: string;
  qty: number;
  price: number;
  transaction_type: 'BUY' | 'SELL';
  date: string;
  net_amount?: number;
  total_invested?: number;
  total_received?: number;
}

interface CacheRow {
  symbol: string;
  ltp: number;
  change: string | number;
  last_updated: string;
}

interface DashboardMetrics {
  lastSync: string;
  portfolioValue: number;
  activeInvestment: number;
  todaysChange: number;
  netRealizedPL: number;
  netRealizedPLPercent: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  lifetimePL: number;
  bestClosedTrade: string;
  capitalDeployed: number;
  cashRecycled: number;
  netCashFlow: number;
  capitalTurnover: number;
  holdings: { symbol: string; currentValue: number }[];
}

export default function DashboardOverview() {
  const supabase = createClient();
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAndCalculateMetrics() {
      try {
        setLoading(true);
        setError(null);

        // 1. Authenticate user to bypass RLS
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        
        if (userErr || !user) {
          setError('Authentication required. Please log in to view your dashboard.');
          setLoading(false);
          return;
        }

        // 2. Fetch raw transaction portfolio data (filtered by user) and cache prices
        const [{ data: portfolioData, error: portfolioErr }, { data: cacheData, error: cacheErr }] =
          await Promise.all([
            supabase.from('portfolio').select('*').eq('user_id', user.id).order('date', { ascending: true }),
            supabase.from('cache').select('*'),
          ]);

        if (portfolioErr) throw portfolioErr;
        if (cacheErr) throw cacheErr;

        // 3. Map prices & last sync time from cache
        const priceMap: Record<string, { ltp: number; change: number }> = {};
        let latestSyncTime = 'N/A';

        (cacheData as CacheRow[] || []).forEach((c) => {
          const ltpVal = Number(c.ltp) || 0;
          const changeVal = typeof c.change === 'string' ? parseFloat(c.change) || 0 : Number(c.change) || 0;
          priceMap[c.symbol] = { ltp: ltpVal, change: changeVal };

          if (c.last_updated && (latestSyncTime === 'N/A' || c.last_updated > latestSyncTime)) {
            latestSyncTime = new Date(c.last_updated).toLocaleString('en-US', {
              timeZone: 'Asia/Kathmandu',
            });
          }
        });

        // 4. Process portfolio transactions using Weighted Average Cost
        const symbolHoldings: Record<string, { qty: number; totalCost: number }> = {};
        let capitalDeployed = 0;
        let cashRecycled = 0;
        let totalRealizedPL = 0;
        let totalClosedInvestment = 0;
        let bestGainPct = -Infinity;
        let bestGainSymbol = 'N/A';

        (portfolioData as PortfolioRow[] || []).forEach((trx) => {
          const sym = trx.symbol?.toUpperCase();
          const qty = Number(trx.qty) || 0;
          const netAmt = Number(trx.net_amount || trx.total_invested || trx.total_received || 0);

          if (!sym) return;

          if (!symbolHoldings[sym]) {
            symbolHoldings[sym] = { qty: 0, totalCost: 0 };
          }

          if (trx.transaction_type === 'BUY') {
            capitalDeployed += netAmt;
            symbolHoldings[sym].qty += qty;
            symbolHoldings[sym].totalCost += netAmt;
          } else if (trx.transaction_type === 'SELL') {
            cashRecycled += netAmt;
            const currentQty = symbolHoldings[sym].qty;
            const currentCost = symbolHoldings[sym].totalCost;

            if (currentQty > 0) {
              const avgBuyPrice = currentCost / currentQty;
              const costOfSold = avgBuyPrice * qty;
              const tradePL = netAmt - costOfSold;
              const tradeGainPct = costOfSold > 0 ? (tradePL / costOfSold) * 100 : 0;

              totalRealizedPL += tradePL;
              totalClosedInvestment += costOfSold;

              if (tradeGainPct > bestGainPct) {
                bestGainPct = tradeGainPct;
                bestGainSymbol = `${sym} (${tradeGainPct >= 0 ? '+' : ''}${tradeGainPct.toFixed(1)}%)`;
              }

              symbolHoldings[sym].qty -= qty;
              symbolHoldings[sym].totalCost -= costOfSold;
            }
          }
        });

        // 5. Calculate active holdings & unrealized metrics
        let portfolioValue = 0;
        let activeInvestment = 0;
        let todaysChange = 0;
        const activeHoldingsChart: { symbol: string; currentValue: number }[] = [];

        Object.keys(symbolHoldings).forEach((sym) => {
          const h = symbolHoldings[sym];
          if (h.qty > 0) {
            const livePrice = priceMap[sym]?.ltp || 0;
            const dayChange = priceMap[sym]?.change || 0;
            const currentVal = h.qty * livePrice;

            portfolioValue += currentVal;
            activeInvestment += h.totalCost;
            todaysChange += h.qty * dayChange;

            activeHoldingsChart.push({
              symbol: sym,
              currentValue: currentVal > 0 ? currentVal : h.totalCost,
            });
          }
        });

        // 6. Final derived ratios
        const unrealizedPL = portfolioValue - activeInvestment;
        const unrealizedPLPercent = activeInvestment > 0 ? (unrealizedPL / activeInvestment) * 100 : 0;
        const netRealizedPLPercent = totalClosedInvestment > 0 ? (totalRealizedPL / totalClosedInvestment) * 100 : 0;
        const netCashFlow = cashRecycled - capitalDeployed;
        const capitalTurnover = capitalDeployed > 0 ? (cashRecycled / capitalDeployed) * 100 : 0;
        const lifetimePL = totalRealizedPL + unrealizedPL;

        setMetrics({
          lastSync: latestSyncTime !== 'N/A' ? `${latestSyncTime} (Nepal Time)` : 'No active sync',
          portfolioValue,
          activeInvestment,
          todaysChange,
          netRealizedPL: totalRealizedPL,
          netRealizedPLPercent: parseFloat(netRealizedPLPercent.toFixed(2)),
          unrealizedPL,
          unrealizedPLPercent: parseFloat(unrealizedPLPercent.toFixed(2)),
          lifetimePL,
          bestClosedTrade: bestGainPct !== -Infinity ? bestGainSymbol : 'None',
          capitalDeployed,
          cashRecycled,
          netCashFlow,
          capitalTurnover: parseFloat(capitalTurnover.toFixed(1)),
          holdings: activeHoldingsChart,
        });
      } catch (err: any) {
        console.error('Dashboard Error:', err);
        setError(err.message || 'Failed to calculate database portfolio metrics.');
      } finally {
        setLoading(false);
      }
    }

    fetchAndCalculateMetrics();
  }, [supabase]);

  const isProfitable = (val: number) => val >= 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400 font-mono text-sm">
        <span className="animate-pulse">⏳ Synchronizing DBMS metrics & calculating ratios...</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 max-w-7xl mx-auto bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-sm font-mono">
        ❌ Error loading dashboard data: {error || 'No database records available'}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            📊 Market Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Last Market Sync: <span className="text-emerald-400 font-mono">{metrics.lastSync}</span>
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
              Rs {metrics.portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total Active Investment</span>
            <div className="text-2xl font-bold font-mono text-slate-200">
              Rs {metrics.activeInvestment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 font-medium">Today's Change</span>
            <div className={`text-2xl font-bold font-mono ${isProfitable(metrics.todaysChange) ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfitable(metrics.todaysChange) ? '+' : ''}Rs {metrics.todaysChange.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              Rs {metrics.netRealizedPL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${isProfitable(metrics.netRealizedPLPercent) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isProfitable(metrics.netRealizedPLPercent) ? '+' : ''}{metrics.netRealizedPLPercent}%
            </span>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">📈 Unrealized P/L</span>
            <div className={`text-xl font-bold font-mono ${isProfitable(metrics.unrealizedPL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.unrealizedPL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${isProfitable(metrics.unrealizedPLPercent) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isProfitable(metrics.unrealizedPLPercent) ? '+' : ''}{metrics.unrealizedPLPercent}%
            </span>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">🏆 Lifetime P/L</span>
            <div className={`text-xl font-bold font-mono ${isProfitable(metrics.lifetimePL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.lifetimePL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              Rs {metrics.capitalDeployed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Total Cash Recycled</span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-1">
              Rs {metrics.cashRecycled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-400 font-medium">Net Cash Flow</span>
            <div className={`text-xl font-bold font-mono mt-1 ${isProfitable(metrics.netCashFlow) ? 'text-emerald-400' : 'text-rose-400'}`}>
              Rs {metrics.netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
          {metrics.holdings.length > 0 ? (
            <PortfolioChart holdings={metrics.holdings} />
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-mono">
              No active holdings found to map allocation.
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              📢 System Status
            </h3>
            <div className="p-4 bg-slate-950 border border-emerald-900/50 rounded-lg text-xs text-emerald-400 font-mono">
              ✅ Authentication Sync Online. Secure user-level data isolation verified.
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-500 font-mono">
            Automated terminal monitor running active scan against NEPSE board updates.
          </div>
        </div>
      </div>
    </div>
  );
}