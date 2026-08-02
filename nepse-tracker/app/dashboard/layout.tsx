'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);

  // Example user state - replace with Supabase auth dynamic user context
  const user = { email: 'user@example.com', name: 'Jagdish Sah' };

  const menuItems = [
    { label: 'Dashboard Overview', path: '/dashboard', icon: '🏠' },
    { label: 'Active Portfolio', path: '/dashboard/portfolio', icon: '💼' },
    { label: 'Add Transaction', path: '/dashboard/add-transaction', icon: '➕' },
    { label: 'My TMS (Cash & Margin)', path: '/dashboard/tms', icon: '🏦' },
    { label: 'Trade Simulation', path: '/dashboard/simulation', icon: '🧮' },
    { label: 'Watchlist & Alerts', path: '/dashboard/watchlist', icon: '🎯' },
    { label: 'Risk & Journal', path: '/dashboard/journal', icon: '🧠' },
    { label: 'Realized History', path: '/dashboard/realized-history', icon: '📜' },
    { label: 'Wealth Trajectory', path: '/dashboard/trajectory', icon: '📈' },
    { label: 'AI Market Analyst', path: '/dashboard/ai-analyst', icon: '🤖' },
    { label: 'Admin: Manage Data', path: '/dashboard/admin', icon: '⚙️' },
    { label: 'System Activity Log', path: '/dashboard/activity-log', icon: '📋' },
  ];

  const handleSync = async () => {
    setIsSyncing(true);
    // Trigger market sync endpoint or scraper script
    setTimeout(() => setIsSyncing(false), 2000);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Header Branding */}
          <div className="p-5 border-b border-slate-800">
            <h1 className="text-lg font-black tracking-wider text-emerald-400 flex items-center gap-2">
              🦅 NEPSE Terminal Pro
            </h1>
            <p className="text-xs text-slate-400 mt-2 truncate">
              Logged in as: <span className="text-slate-200 font-medium">{user.name || user.email}</span>
            </p>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <span className={isSyncing ? 'animate-spin' : ''}>⚙️</span>
            {isSyncing ? 'Syncing Market...' : 'Market Sync'}
          </button>

          <button
            onClick={() => {/* Supabase Signout */}}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition"
          >
            <span>🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Render Area */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}