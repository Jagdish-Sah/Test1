'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client safely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // State Management
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Authenticated User Listener
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          const u = session.user;
          setUser({
            email: u.email ?? '',
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || 'Terminal Operator',
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching auth session:', err);
      } finally {
        setIsAuthLoading(false);
      }
    };

    fetchSession();

    // Subscribe to auth state updates (Logins, Logouts, Session Restores)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          email: u.email ?? '',
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || 'Terminal Operator',
        });
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  // Market Sync Handler
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      /*
       * 🟢 FUTURE API INTEGRATION:
       * Replace simulated timeout with live endpoint fetch:
       * 
       * const res = await fetch('/api/market/sync', { method: 'POST' });
       * if (!res.ok) throw new Error('Failed to synchronize market data');
       * const result = await res.json();
       */

      // Simulated network request delay
      await new Promise((resolve) => setTimeout(resolve, 1800));

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Market sync failed:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sign Out Handler
  const handleLogOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Mobile Top Header */}
      <header className="flex md:hidden items-center justify-between p-4 bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <h1 className="text-base font-black text-emerald-400 flex items-center gap-2">
          🦅 NEPSE Terminal Pro
        </h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
          className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-slate-900/95 md:bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between shrink-0 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Header Branding */}
          <div className="p-5 border-b border-slate-800 hidden md:block">
            <h1 className="text-lg font-black tracking-wider text-emerald-400 flex items-center gap-2">
              🦅 NEPSE Terminal Pro
            </h1>

            <div className="mt-2 min-h-[20px]">
              {isAuthLoading ? (
                <div className="h-4 w-3/4 bg-slate-800 animate-pulse rounded"></div>
              ) : (
                <p className="text-xs text-slate-400 truncate" title={user?.email || 'Unauthenticated'}>
                  Logged in as:{' '}
                  <span className="text-slate-200 font-medium font-mono">
                    {user?.email || user?.name || 'Not Authenticated'}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* User Status Bar (Mobile Sidebar Header) */}
          <div className="p-4 border-b border-slate-800 md:hidden">
            <p className="text-xs text-slate-400 truncate">
              Operator:{' '}
              <span className="text-slate-200 font-medium font-mono">
                {user?.email || user?.name || 'Not Authenticated'}
              </span>
            </p>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)] md:max-h-none">
            {menuItems.map((item) => {
              // Smart nested route highlighting
              const isActive =
                item.path === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <span className="text-base" role="img" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          {/* Sync Status Badge */}
          {syncStatus === 'success' && (
            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded py-1 px-2 text-center">
              ✓ Market sync successful
            </div>
          )}
          {syncStatus === 'error' && (
            <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded py-1 px-2 text-center">
              ✕ Market sync failed
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 ${
              isSyncing
                ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 shadow-sm'
            }`}
          >
            <span className={isSyncing ? 'animate-spin' : ''}>⚙️</span>
            {isSyncing ? 'Syncing Market...' : 'Market Sync'}
          </button>

          <button
            onClick={handleLogOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all duration-200"
          >
            <span>🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Render Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-br from-slate-950 to-slate-900">
        {children}
      </main>
    </div>
  );
}