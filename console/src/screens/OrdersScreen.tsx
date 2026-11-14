import React, { useState } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { formatPaise } from '../utils/currency';
import { formatRelativeTime, formatExactTime } from '../utils/time';

interface OrdersScreenProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  orders,
  onSelectOrder,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3" />
            <span>Waiting for payment</span>
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            <span>Paid</span>
          </span>
        );
      case 'FULFILLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Truck className="h-3 w-3" />
            <span>Fulfilled</span>
          </span>
        );
      case 'PAYMENT_FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-3 w-3" />
            <span>Payment failed</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="h-3 w-3" />
            <span>Expired</span>
          </span>
        );
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'pending' && o.status !== 'PENDING_PAYMENT') return false;
    if (filter === 'paid' && o.status !== 'PAID' && o.status !== 'FULFILLED') return false;
    if (filter === 'failed' && o.status !== 'PAYMENT_FAILED' && o.status !== 'EXPIRED') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const inId = o.id.toLowerCase().includes(q);
      const inRzp = o.razorpayOrderId.toLowerCase().includes(q);
      const inItems = o.items.some((i) => i.name.toLowerCase().includes(q));
      if (!inId && !inRzp && !inItems) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Title & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Orders
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse and inspect customer quick-commerce grocery orders.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search orders or items..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 w-48 sm:w-60"
            />
          </div>

          {/* Filter Segmented Control */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'pending'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'paid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Paid
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filter === 'failed'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Failed
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <ShoppingBag className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs">No orders found matching the filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 shrink-0">
                    <ShoppingBag className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {order.id}
                      </span>
                      {renderStatusBadge(order.status)}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                      {order.items.length} items (
                      {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')})
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 shrink-0 text-right">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatPaise(order.breakdown.totalPaise)}
                    </div>
                    <div
                      className="text-[11px] text-slate-400 dark:text-slate-500 font-mono"
                      title={formatExactTime(order.createdAt)}
                    >
                      {formatRelativeTime(order.createdAt)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

