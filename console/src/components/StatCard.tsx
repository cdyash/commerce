import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  helperText?: string;
  icon: LucideIcon;
  badge?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  helperText,
  icon: Icon,
  badge,
  variant = 'default',
}) => {
  const colorMap = {
    default: {
      bg: 'bg-brand-50 dark:bg-brand-950/40',
      icon: 'text-brand-600 dark:text-brand-400',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      icon: 'text-amber-600 dark:text-amber-400',
    },
    danger: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      icon: 'text-rose-600 dark:text-rose-400',
    },
  };

  const selectedColor = colorMap[variant];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={`p-2 rounded-xl ${selectedColor.bg}`}>
          <Icon className={`h-4 w-4 ${selectedColor.icon}`} />
        </div>
      </div>

      <div className="mt-3 flex items-baseline space-x-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {value}
        </span>
        {badge && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {badge}
          </span>
        )}
      </div>

      {helperText && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
};

