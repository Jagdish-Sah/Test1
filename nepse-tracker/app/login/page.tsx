'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      if (isSigningUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Handles whether Supabase requires email verification
        if (!data.session) {
          setInfoMsg('Account created! Please check your email inbox to verify your account.');
        } else {
          router.refresh();
          router.push('/dashboard');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        router.refresh();
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="max-w-md w-full bg-slate-900 p-8 rounded-xl shadow-xl border border-slate-800 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-center text-white">
            {isSigningUp ? 'Create NEPSE Tracker Account' : 'Sign In to NEPSE Tracker'}
          </h2>
          <p className="text-xs text-center text-slate-400 mt-1">
            {isSigningUp ? 'Register to manage your portfolio' : 'Access your settlement engine & holdings'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-3 rounded-lg text-xs font-mono">
            ❌ {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-3 rounded-lg text-xs font-mono">
            ℹ️ {infoMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold p-2.5 text-xs rounded-lg transition shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {loading ? 'Processing...' : isSigningUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsSigningUp(!isSigningUp);
              setErrorMsg('');
              setInfoMsg('');
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition underline"
          >
            {isSigningUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}