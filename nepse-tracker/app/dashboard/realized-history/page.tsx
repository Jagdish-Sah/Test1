'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// --- Types ---
interface RawTransaction {
  id: string;
  symbol: string;
  qty: number;
  price: number;
  transaction_type: 'BUY' | 'SELL';
  date: string;
  net_amount: number;
}

interface CacheRow {
  symbol: string;
  ltp: number;
}

interface RealizedTrade extends RawTransaction {
  cogs: number; // Cost of Goods Sold
  pnl: number;
  pnlPercent: number;
}

interface RealizedAggregate {
  symbol: string;
  totalRealized: number;
  totalSold: number;
  totalCogs: number;
  pnlPercent: number;
  tradeCount: number;
}

interface UnrealizedHolding {
  symbol: string;
  qty: number;
  totalCost: number;
  wacc: number;
  ltp: number;
  currentValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

type TabType = 'AGGREGATE' | 'REALIZED_ALL' | 'UNREALIZED' | 'BOTH';

export default function HistoryPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<TabType>('AGGREGATE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [ledger, setLedger] = useState<RawTransaction[]>([]);
  const [realizedAll, setRealizedAll] = useState<RealizedTrade[]>([]);
  const [realizedAgg, setRealizedAgg] = useState<RealizedAggregate[]>([]);
  const [unrealized, setUnrealized] = useState<UnrealizedHolding[]>([]);

  useEffect(() => {
    async function processHistory() {
      try {
        setLoading(true);
        setError(null);

        // 1. Auth Check
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error('Authentication required.');

        // 2. Fetch Data
        const [{ data: portfolioData, error: portfolioErr }, { data: cacheData, error: cacheErr }] =
          await Promise.all([
            supabase.from('portfolio').select('*').eq('user_id', user.id).order('date', { ascending: true }),
            supabase.from('cache').select('symbol, ltp'),
          ]);

        if (portfolioErr) throw portfolioErr;
        if (cacheErr) throw cacheErr;

        const priceMap: Record<string, number> = {};
        (cacheData as CacheRow[] || []).forEach(c => {
          priceMap[c.symbol.toUpperCase()] = Number(c.ltp) || 0;
        });

        // 3. WACC Processing Engine
        const rawLedger: RawTransaction[] = [];
        const sellsList: RealizedTrade[] = [];
        const aggMap: Record<string, RealizedAggregate> = {};
        const holdingsMap: Record<string, { qty: number; cost: number }> = {};

        (portfolioData as any[] || []).forEach((row) => {
          const sym = row.symbol?.toUpperCase();
          const qty = Number(row.qty) || 0;
          const netAmt = Number(row.net_amount || row.total_invested || row.total_received || 0);
          
          if (!sym) return;

          const trx: RawTransaction = {
            id: row.id,
            symbol: sym,
            qty,
            price: Number(row.price),
            transaction_type: row.transaction_type,
            date: row.date,
            net_amount: netAmt
          };
          
          rawLedger.push(trx);

          if (!holdingsMap[sym]) holdingsMap[sym] = { qty: 0, cost: 0 };

          if (trx.transaction_type === 'BUY') {
            holdingsMap[sym].qty += qty;
            holdingsMap[sym].cost += netAmt;
          } else if (trx.transaction_type === 'SELL') {
            const h = holdingsMap[sym];
            if (h.qty > 0) {
              const wacc = h.cost / h.qty;
              const cogs = wacc * qty;
              const pnl = netAmt - cogs;
              const pnlPercent = cogs > 0 ? (pnl / cogs) * 100 : 0;

              // Log Individual Realized Trade
              sellsList.push({ ...trx, cogs, pnl, pnlPercent });

              // Log Aggregate
              if (!aggMap[sym]) {
                aggMap[sym] = { symbol: sym, totalRealized: 0, totalSold: 0, totalCogs: 0, pnlPercent: 0, tradeCount: 0 };
              }
              aggMap[sym].totalRealized += pnl;
              aggMap[sym].totalSold += netAmt;
              aggMap[sym].totalCogs += cogs;
              aggMap[sym].tradeCount += 1;

              // Reduce Capital
              h.qty -= qty;
              h.cost -= cogs;
            }
          }
        });

        // 4. Finalize Aggregates
        const finalAgg = Object.values(aggMap).map(agg => {
          agg.pnlPercent = agg.totalCogs > 0 ? (agg.totalRealized / agg.totalCogs) * 100 : 0;
          return agg;
        }).sort((a, b) => b.totalRealized - a.totalRealized);

        // 5. Finalize Unrealized
        const finalUnrealized: UnrealizedHolding[] = [];
        Object.keys(holdingsMap).forEach(sym => {
          const h = holdingsMap[sym];
          if (h.qty > 0.01) {
            const ltp = priceMap[sym] || 0;
            const wacc = h.cost / h.qty;
            const currentValue = h.qty * ltp;
            const unrealizedPL = currentValue - h.cost;
            const unrealizedPLPercent = h.cost > 0 ? (unrealizedPL / h.cost) * 100 : 0;

            finalUnrealized.push({
              symbol: sym,
              qty: h.qty,
              totalCost: h.cost,
              wacc,
              ltp,
              currentValue,
              unrealizedPL,
              unrealizedPLPercent
            });
          }
        });
        finalUnrealized.sort((a, b) => b.unrealizedPL - a.unrealizedPL);

        // Sort Ledger & Sells newest first for display
        rawLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        sellsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setLedger(rawLedger);
        setRealizedAll(sellsList);
        setRealizedAgg(finalAgg);
        setUnrealized(finalUnrealized);

      } catch (err: any) {
        console.error('History Error:', err);
        setError(err.message || 'Failed to process transaction ledger.');
      } finally {
        setLoading(false);
      }
    }

    processHistory();
  }, [supabase]);

  const isProfitable = (val: number) => val >= 0;
  const formatRs = (val: number) => `Rs ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400 font-mono text-sm">
        <span className="animate-pulse">⏳ Reconstructing historical ledgers & processing WACC nodes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-sm font-mono max-w-7xl mx-auto">
        ❌ Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            📜 Ledger & P/L History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive lifecycle breakdown of realized and floating capital.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900/60 p-1 border border-slate-800 rounded-lg overflow-x-auto hide-scrollbar">
          {[
            { id: 'AGGREGATE', label: 'Realized (Agg)' },
            { id: 'REALIZED_ALL', label: 'Realized (All)' },
            { id: 'UNREALIZED', label: 'Unrealized' },
            { id: 'BOTH', label: 'Ledger (Both)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- TAB CONTENT RENDERERS --- */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          
          {/* TAB 1: AGGREGATE */}
          {activeTab === 'AGGREGATE' && (
            <table className="w-full text-left text-xs font-mono min-w-[800px]">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Symbol</th>
                  <th className="py-3.5 px-4 text-right">Trades (Sells)</th>
                  <th className="py-3.5 px-4 text-right">Total Invested (COGS)</th>
                  <th className="py-3.5 px-4 text-right">Total Recovered</th>
                  <th className="py-3.5 px-4 text-right">Net Realized P/L</th>
                  <th className="py-3.5 px-4 text-right">Yield %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {realizedAgg.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">No realized trades found.</td></tr>
                ) : (
                  realizedAgg.map((row) => (
                    <tr key={row.symbol} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-200">{row.symbol}</td>
                      <td className="py-3 px-4 text-right">{row.tradeCount}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.totalCogs)}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.totalSold)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${isProfitable(row.totalRealized) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable(row.totalRealized) ? '+' : ''}{formatRs(row.totalRealized)}
                      </td>
                      <td className={`py-3 px-4 text-right ${isProfitable(row.pnlPercent) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable(row.pnlPercent) ? '+' : ''}{row.pnlPercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: REALIZED ALL (INDIVIDUAL TRADES) */}
          {activeTab === 'REALIZED_ALL' && (
            <table className="w-full text-left text-xs font-mono min-w-[800px]">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Symbol</th>
                  <th className="py-3.5 px-4 text-right">Qty Sold</th>
                  <th className="py-3.5 px-4 text-right">Sell Price</th>
                  <th className="py-3.5 px-4 text-right">COGS (WACC Base)</th>
                  <th className="py-3.5 px-4 text-right">Net Received</th>
                  <th className="py-3.5 px-4 text-right">Realized P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {realizedAll.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No sell transactions found.</td></tr>
                ) : (
                  realizedAll.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400">{new Date(row.date).toISOString().split('T')[0]}</td>
                      <td className="py-3 px-4 font-bold">{row.symbol}</td>
                      <td className="py-3 px-4 text-right">{row.qty}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.price)}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{formatRs(row.cogs)}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.net_amount)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${isProfitable(row.pnl) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <div>{isProfitable(row.pnl) ? '+' : ''}{formatRs(row.pnl)}</div>
                        <div className="text-[10px] opacity-80">{isProfitable(row.pnlPercent) ? '+' : ''}{row.pnlPercent.toFixed(2)}%</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: UNREALIZED */}
          {activeTab === 'UNREALIZED' && (
            <table className="w-full text-left text-xs font-mono min-w-[800px]">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Symbol</th>
                  <th className="py-3.5 px-4 text-right">Active Qty</th>
                  <th className="py-3.5 px-4 text-right">WACC</th>
                  <th className="py-3.5 px-4 text-right">LTP</th>
                  <th className="py-3.5 px-4 text-right">Total Invested</th>
                  <th className="py-3.5 px-4 text-right">Current Value</th>
                  <th className="py-3.5 px-4 text-right">Unrealized P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {unrealized.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No active holdings found.</td></tr>
                ) : (
                  unrealized.map((row) => (
                    <tr key={row.symbol} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-sky-400">{row.symbol}</td>
                      <td className="py-3 px-4 text-right">{row.qty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.wacc)}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.ltp)}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{formatRs(row.totalCost)}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.currentValue)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${isProfitable(row.unrealizedPL) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <div>{isProfitable(row.unrealizedPL) ? '+' : ''}{formatRs(row.unrealizedPL)}</div>
                        <div className="text-[10px] opacity-80">{isProfitable(row.unrealizedPLPercent) ? '+' : ''}{row.unrealizedPLPercent.toFixed(2)}%</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: BOTH (RAW LEDGER) */}
          {activeTab === 'BOTH' && (
            <table className="w-full text-left text-xs font-mono min-w-[800px]">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Symbol</th>
                  <th className="py-3.5 px-4 text-right">Qty</th>
                  <th className="py-3.5 px-4 text-right">Price</th>
                  <th className="py-3.5 px-4 text-right">Net Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {ledger.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">No ledger entries found.</td></tr>
                ) : (
                  ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400">{new Date(row.date).toISOString().split('T')[0]}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${row.transaction_type === 'BUY' ? 'bg-sky-500/10 text-sky-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {row.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">{row.symbol}</td>
                      <td className="py-3 px-4 text-right">{row.qty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{formatRs(row.price)}</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatRs(row.net_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {/* Footer Note */}
      <div className="text-right text-[10px] text-slate-500 font-mono">
        * Realized calculations utilize a Weighted Average Cost of Capital (WACC) chronologically parsed from your transaction log.
      </div>
    </div>
  );
}