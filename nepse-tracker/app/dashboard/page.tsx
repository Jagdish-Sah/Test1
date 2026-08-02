'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import PortfolioChart from '@/components/PortfolioChart';

interface Transaction {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  transaction_date: string;
}

interface MarketData {
  symbol: string;
  price: number;
  ltp?: number;
}

interface Holding {
  symbol: string;
  quantity: number;
  totalCost: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);

    // 1. Fetch or create default portfolio
    let { data: portfolios } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    let pId = portfolios?.[0]?.id;
    if (!pId) {
      const { data: newP } = await supabase
        .from('portfolios')
        .insert([{ user_id: user.id, name: 'Main Portfolio' }])
        .select('id')
        .single();
      pId = newP?.id;
    }
    setPortfolioId(pId);

    if (pId) {
      // 2. Fetch User Transactions & Live Market Data concurrently
      const [txRes, marketRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('portfolio_id', pId).order('transaction_date', { ascending: false }),
        supabase.from('market_data').select('*')
      ]);

      const txList: Transaction[] = txRes.data || [];
      const marketList: MarketData[] = marketRes.data || [];
      setTransactions(txList);

      // 3. Compute Portfolio Holdings & P&L
      const holdingMap: Record<string, { qty: number; cost: number }> = {};

      txList.forEach((tx) => {
        const sym = tx.symbol.toUpperCase();
        if (!holdingMap[sym]) holdingMap[sym] = { qty: 0, cost: 0 };

        if (tx.type === 'BUY') {
          holdingMap[sym].qty += tx.quantity;
          holdingMap[sym].cost += tx.quantity * tx.price;
        } else {
          holdingMap[sym].qty -= tx.quantity;
          holdingMap[sym].cost -= tx.quantity * tx.price;
        }
      });

      const computedHoldings: Holding[] = Object.entries(holdingMap)
        .filter(([_, data]) => data.qty > 0)
        .map(([sym, data]) => {
          const marketItem = marketList.find((m) => m.symbol === sym);
          const currentPrice = marketItem?.price || marketItem?.ltp || (data.cost / data.qty);
          const avgBuyPrice = data.cost / data.qty;
          const currentValue = data.qty * currentPrice;
          const gainLoss = currentValue - data.cost;
          const gainLossPercent = data.cost > 0 ? (gainLoss / data.cost) * 100 : 0;

          return {
            symbol: sym,
            quantity: data.qty,
            totalCost: data.cost,
            avgBuyPrice,
            currentPrice,
            currentValue,
            gainLoss,
            gainLossPercent
          };
        });

      setHoldings(computedHoldings);
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioId || !symbol || !quantity || !price) return;

    setSubmitting(true);
    const { error } = await supabase.from('transactions').insert([
      {
        portfolio_id: portfolioId,
        symbol: symbol.toUpperCase().trim(),
        type,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        transaction_date: date,
      },
    ]);

    if (error) {
      alert('Error saving transaction: ' + error.message);
    } else {
      setSymbol('');
      setQuantity('');
      setPrice('');
      await loadUserData();
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Top Level Portfolio Summary Totals
  const totalInvested = holdings.reduce((acc, h) => acc + h.totalCost, 0);
  const totalCurrentValue = holdings.reduce((acc, h) => acc + h.currentValue, 0);
  const totalProfitLoss = totalCurrentValue - totalInvested;
  const totalReturnPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white p-8">Loading analytics...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center border-b border-gray-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">NEPSE Portfolio Analytics</h1>
          <p className="text-gray-400 text-xs md:text-sm">Account: {user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded text-sm font-semibold transition"
        >
          Sign Out
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-xs uppercase font-medium">Invested Capital</p>
            <p className="text-2xl font-bold mt-1">
              NPR {totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-xs uppercase font-medium">Current Market Value</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              NPR {totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-xs uppercase font-medium">Unrealized Profit/Loss</p>
            <p className={`text-2xl font-bold mt-1 ${totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalProfitLoss >= 0 ? '+' : ''}NPR {totalProfitLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-xs uppercase font-medium">Total Return</p>
            <p className={`text-2xl font-bold mt-1 ${totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalReturnPercent >= 0 ? '+' : ''}{totalReturnPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Visual Analytics Grid: Pie Chart + Current Holdings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Portfolio Allocation Chart */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-1">Asset Allocation</h3>
            <p className="text-xs text-gray-400 mb-4">Weight breakdown by asset value</p>
            <PortfolioChart holdings={holdings} />
          </div>

          {/* Holdings Summary Table */}
          <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Current Holdings</h3>
            {holdings.length === 0 ? (
              <p className="text-gray-400 text-sm">No active holdings calculated. Log trades below (e.g. NABIL, HDL, NIFRA).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-2">Symbol</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Avg Buy</th>
                      <th className="py-2">LTP</th>
                      <th className="py-2">Current Value</th>
                      <th className="py-2">P&L</th>
                      <th className="py-2">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {holdings.map((h) => (
                      <tr key={h.symbol} className="hover:bg-gray-750">
                        <td className="py-3 font-bold text-white">{h.symbol}</td>
                        <td className="py-3">{h.quantity}</td>
                        <td className="py-3">NPR {h.avgBuyPrice.toFixed(2)}</td>
                        <td className="py-3 text-blue-300 font-medium">NPR {h.currentPrice.toFixed(2)}</td>
                        <td className="py-3 font-semibold">NPR {h.currentValue.toLocaleString()}</td>
                        <td className={`py-3 font-semibold ${h.gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {h.gainLoss >= 0 ? '+' : ''}NPR {h.gainLoss.toLocaleString()}
                        </td>
                        <td className={`py-3 font-bold ${h.gainLossPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {h.gainLossPercent >= 0 ? '+' : ''}{h.gainLossPercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Trade Entry & History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Log Trade</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Symbol</label>
                <input
                  type="text"
                  placeholder="NABIL, HDL, NIFRA"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm uppercase focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Price (NPR)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="520"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 font-semibold p-2.5 rounded transition text-sm"
              >
                {submitting ? 'Logging...' : 'Log Transaction'}
              </button>
            </form>
          </div>

          {/* Right Column: History */}
          <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Transaction Logs</h3>
            {transactions.length === 0 ? (
              <p className="text-gray-400 text-sm">No transaction history found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-2">Date</th>
                      <th className="py-2">Symbol</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Price</th>
                      <th className="py-2">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-3 text-gray-300">{tx.transaction_date}</td>
                        <td className="py-3 font-semibold text-white">{tx.symbol}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              tx.type === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3">{tx.quantity}</td>
                        <td className="py-3">NPR {tx.price}</td>
                        <td className="py-3 font-medium">
                          NPR {(tx.quantity * tx.price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}