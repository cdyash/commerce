import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  CreditCard,
  SlidersHorizontal,
} from 'lucide-react';

export type ScreenId = 'overview' | 'orders' | 'catalog' | 'payments' | 'controls';

interface NavigationProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  orderCount?: number;
  pendingOrderCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentScreen,
  onSelectScreen,
  orderCount = 0,
  pendingOrderCount = 0,
}) => {
  const navItems: { id: ScreenId; label: string; icon: React.FC<{ className?: string }>; badge?: number | string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingBag,
      badge: pendingOrderCount > 0 ? `${pendingOrderCount} pending` : orderCount > 0 ? String(orderCount) : undefined,
    },
    { id: 'catalog', label: 'Catalog', icon: Package },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'controls', label: 'Demo controls', icon: SlidersHorizontal },
  ];

  return (
    <nav className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectScreen(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <div className="font-medium text-slate-700 dark:text-slate-300">QuickCart Merchant</div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
          Reference mock backend for FlexiMCP gateway testing.
        </p>
      </div>
    </nav>
  );
};

