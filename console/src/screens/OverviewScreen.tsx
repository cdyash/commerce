import React from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
  Webhook,
  RotateCcw,
} from 'lucide-react';
import { AdminState, SystemEvent } from '../types';
import { StatCard } from '../components/StatCard';
import { formatRelativeTime, formatExactTime } from '../utils/time';

interface OverviewScreenProps {
  state: AdminState | null;
  onNavigateToOrders: () => void;
  onOpenOrder: (orderId: string) => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  state,
  onNavigateToOrders,
  onOpenOrder,
}) => {
  const counts = state?.counts;
  const recentEvents = state?.recentEvents || [];

  const getEventIcon = (type: SystemEvent['type']) => {
    switch (type) {
      case 'order_transition':
        return <ShoppingBag className="h-4 w-4 text-brand-500" />;
      case 'webhook_received':
        return <Webhook className="h-4 w-4 text-indigo-500" />;
      case 'promo_rejected':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'spec_changed':
        return <Layers className="h-4 w-4 text-purple-500" />;
      case 'admin_reset':
        return <RotateCcw className="h-4 w-4 text-slate-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Overview
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Real-time snapshot of grocery orders, webhook receipts, and activity.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Orders Today"
          value={counts?.ordersTotal ?? 0}
          helperText="Total sessions created"
          icon={ShoppingBag}
          variant="default"
        />
        <StatCard
          title="Paid & Confirmed"
          value={(counts?.ordersPaid ?? 0) + (counts?.ordersFulfilled ?? 0)}
          helperText={`${counts?.ordersFulfilled ?? 0} dispatched`}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Waiting for Payment"
          value={counts?.ordersPending ?? 0}
          helperText="15m auto-expiry window"
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Payment Failed"
          value={counts?.ordersFailed ?? 0}
          helperText="Cart preserved for retry"
          icon={AlertCircle}
          variant="danger"
        />
      </div>

      {/* Live Activity Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Live Activity
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Live updates recorded in merchant ring buffer
            </p>
          </div>
          <button
            onClick={onNavigateToOrders}
            className="flex items-center space-x-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            <span>View all orders</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <Sparkles className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs">No activity events recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-96 overflow-y-auto">
            {recentEvents.slice(0, 15).map((evt) => {
              const orderId = (evt.details?.orderId as string) || undefined;
              return (
                <div
                  key={evt.id}
                  className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center space-x-3 text-xs min-w-0">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                      {getEventIcon(evt.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {evt.description}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center space-x-2">
                        <span title={evt.timestamp}>{formatRelativeTime(evt.timestamp)}</span>
                        {orderId && (
                          <button
                            onClick={() => onOpenOrder(orderId)}
                            className="text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            {orderId}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-[10px] text-slate-400 font-mono shrink-0 hidden sm:inline"
                    title={evt.timestamp}
                  >
                    {formatExactTime(evt.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

