import React from 'react';
import { ShoppingCart, ShieldCheck, Moon, Sun, Lock } from 'lucide-react';
import { HealthStatus } from '../types';

interface HeaderProps {
  health: HealthStatus | null;
  specVersion: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenKeyModal: () => void;
  hasKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  specVersion,
  darkMode,
  onToggleDarkMode,
  onOpenKeyModal,
  hasKey,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm shadow-brand-500/20">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-semibold text-slate-900 dark:text-white tracking-tight text-base">
              QuickCart
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/40">
              Merchant Console
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              spec {specVersion}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Health status dot */}
        <div className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                health?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            {health?.status === 'ok' ? 'API Online' : 'Connecting...'}
          </span>
          {health?.uptimeSeconds !== undefined && (
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">
              up {Math.floor(health.uptimeSeconds / 60)}m
            </span>
          )}
        </div>

        {/* Admin key button */}
        <button
          onClick={onOpenKeyModal}
          className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            hasKey
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
          }`}
          title="Admin Key configured in memory"
        >
          {hasKey ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          <span>{hasKey ? 'Admin Key Set' : 'Enter Admin Key'}</span>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};

