'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface HoldingItem {
  ticker: string;
  units: number;
  wacc: number;
  be: number;
  ltp: number;
  totalInvested: number;
  netReceivable: number;
  pnlAmount: number;
  pnlPercent: number;
  weightage: number;
}

interface PortfolioSummary {
  totalInvested: number;
  netReceivable: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

// NEPSE Fee Calculation Helpers
const getBrokerCommission = (amount: number) => {
  if (amount <= 50000) return amount * 0.0036; // 0.36%
  if (amount <= 500000) return amount * 0.0033; // 0.33%
  if (amount <= 2000000) return amount * 0.00306; // 0.306%
  if (amount <= 10000000) return amount * 0.0027; // 0.27%
  return amount * 0.0024; // 0.24%
};

const calculateSellCharges = (units: number, price: number) => {
  const amount = units * price;
  const brokerFee = getBrokerCommission(amount);
  const sebonFee = amount * 0.00015; // 0.015%
  const dpFee = 25; // Flat Rs 25
  return brokerFee + sebonFee + dpFee;
};

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalInvested: 0,
    netReceivable: 0,
    unrealizedPL: 0,
    unrealizedPLPercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolioData() {
      try {
        setLoading(true);

        // 1. Fetch raw transaction portfolio data and cache prices
        const [{ data: portfolioData, error: portfolioErr }, { data: cacheData, error: cacheErr }] =
          await Promise.all([
            supabase.from('portfolio').select('*').order('date', { ascending: true }),
            supabase.from('cache').select('*'),
          ]);

        if (portfolioErr) throw portfolioErr;
        if (cacheErr) throw cacheErr;

        // 2. Map Live Prices from Cache
        const priceMap: Record<string, number> = {};
        (cacheData || []).forEach((c) => {
          priceMap[c.symbol] = Number(c.ltp) || 0;
        });

        // 3. Aggregate Transactions into Active Holdings
        // Using WACC methodology: selling reduces invested capital proportionally to units
        const aggregatedHoldings: Record<string, { units: number; invested: number }> = {};

        (portfolioData || []).forEach((trx) => {
          const sym = trx.symbol?.toUpperCase();
          const qty = Number(trx.qty) || 0;
          const netAmt = Number(trx.net_amount || trx.total_invested || trx.total_received || 0);

          if (!sym) return;

          if (!aggregatedHoldings[sym]) {
            aggregatedHoldings[sym] = { units: 0, invested: 0 };
          }

          if (trx.transaction_type === 'BUY') {
            aggregatedHoldings[sym].units += qty;
            aggregatedHoldings[sym].invested += netAmt; // Net amount should already include buy fees
          } else if (trx.transaction_type === 'SELL') {
            const currentUnits = aggregatedHoldings[sym].units;
            if (currentUnits > 0) {
              const currentWacc = aggregatedHoldings[sym].invested / currentUnits;
              aggregatedHoldings[sym].units -= qty;
              aggregatedHoldings[sym].invested -= currentWacc * qty;
            }
          }
        });

        // 4. Calculate Individual Metrics (WACC, BE, PNL, Net Receivable)
        let totalPortfolioInvested = 0;
        let totalPortfolioReceivable = 0;
        const activeHoldings: HoldingItem[] = [];

        Object.keys(aggregatedHoldings).forEach((sym) => {
          const h = aggregatedHoldings[sym];
          if (h.units > 0.01) { // Filter out closed positions
            const ltp = priceMap[sym] || 0;
            const wacc = h.invested / h.units;
            
            // Break-Even Calculation:
            // What price do we need to sell at so that (Units * Price) - SellCharges = Total Invested?
            // Formula approx: (Invested + DP Fee) / (Units * (1 - MaxBrokerRate - SEBONRate))
            const be = (h.invested + 25) / (h.units * (1 - 0.0036 - 0.00015));

            const sellCharges = calculateSellCharges(h.units, ltp);
            const netReceivable = (h.units * ltp) - sellCharges;
            const pnlAmount = netReceivable - h.invested;
            const pnlPercent = h.invested > 0 ? (pnlAmount / h.invested) * 100 : 0;

            totalPortfolioInvested += h.invested;
            totalPortfolioReceivable += netReceivable;

            activeHoldings.push({
              ticker: sym,
              units: h.units,
              totalInvested: h.invested,
              wacc,
              be,
              ltp,
              netReceivable,
              pnlAmount,
              pnlPercent,
              weightage: 0, // Calculated in next step
            });
          }
        });

        // 5. Calculate Weightage & Final Summary
        activeHoldings.forEach((h) => {
          h.weightage = totalPortfolioReceivable > 0 
            ? (h.netReceivable / totalPortfolioReceivable) * 100 
            : 0;
        });

        // Sort by highest weightage
        activeHoldings.sort((a, b) => b.weightage - a.weightage);

        const totalUnrealizedPL = totalPortfolioReceivable - totalPortfolioInvested;
        const totalUnrealizedPLPercent = totalPortfolioInvested > 0 
          ? (totalUnrealizedPL / totalPortfolioInvested) * 100 
          : 0;

        setSummary({
          totalInvested: totalPortfolioInvested,
          netReceivable: totalPortfolioReceivable,
          unrealizedPL: totalUnrealizedPL,
          unrealizedPLPercent: totalUnrealizedPLPercent,
        });

        setHoldings(activeHoldings);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch and calculate portfolio data.');
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolioData();
  }, []);

  const isProfitable = (val: number) => val >= 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400 font-mono text-sm">
        <span className="animate-pulse">⏳ Aggregating database holdings & running calculations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-sm">
        ❌ Error: {error}
      </div>
    );
  }

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
            Rs {summary.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium">Net Receivable (at LTP)</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            Rs {summary.netReceivable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-xs text-slate-400 font-medium">True Unrealized P/L</span>
          <div className="flex items-baseline justify-between">
            <div className={`text-2xl font-bold font-mono ${isProfitable(summary.unrealizedPL) ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfitable(summary.unrealizedPL) ? '+' : ''}Rs {summary.unrealizedPL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isProfitable(summary.unrealizedPLPercent) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {isProfitable(summary.unrealizedPLPercent) ? '+' : ''}{summary.unrealizedPLPercent.toFixed(2)}%
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
          <table className="w-full text-left text-xs font-mono min-w-[800px]">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Ticker</th>
                <th className="py-3.5 px-4 text-right">Units</th>
                <th className="py-3.5 px-4 text-right">WACC</th>
                <th className="py-3.5 px-4 text-right">B.E. Price</th>
                <th className="py-3.5 px-4 text-right">LTP</th>
                <th className="py-3.5 px-4 text-right">Net Receivable</th>
                <th className="py-3.5 px-4 text-right">P/L %</th>
                <th className="py-3.5 px-4 text-right w-32">Weightage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No active positions found in database.
                  </td>
                </tr>
              ) : (
                holdings.map((h) => {
                  const isGain = h.pnlPercent >= 0;
                  return (
                    <tr key={h.ticker} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-emerald-400">{h.ticker}</td>
                      <td className="py-3.5 px-4 text-right">{h.units.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right text-slate-300">Rs {h.wacc.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-amber-400/90">Rs {h.be.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-semibold">Rs {h.ltp.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right">Rs {h.netReceivable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className={`py-3.5 px-4 text-right font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isGain ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[10px] text-slate-400">{h.weightage.toFixed(1)}%</span>
                          <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${h.weightage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Data Disclosure Note */}
      <div className="text-[10px] text-slate-500 text-right font-mono">
        * "Net Receivable" and "B.E." are calculated assuming active NEPSE Broker Commisions (Slabs 0.24% - 0.36%), SEBON fee (0.015%), and flat DP fee (Rs 25). Capital Gains Tax (CGT) is excluded from Net Receivable until realization.
      </div>
    </div>
  );
}