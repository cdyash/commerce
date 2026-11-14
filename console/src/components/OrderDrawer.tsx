import React, { useState } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  MapPin,
  FileCode,
  Tag,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { formatPaise } from '../utils/currency';
import { formatExactTime, formatRelativeTime } from '../utils/time';

interface OrderDrawerProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderDrawer: React.FC<OrderDrawerProps> = ({ order, onClose }) => {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!order) return null;

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3" />
            <span>Waiting for payment</span>
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            <span>Paid</span>
          </span>
        );
      case 'FULFILLED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Truck className="h-3 w-3" />
            <span>Fulfilled</span>
          </span>
        );
      case 'PAYMENT_FAILED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-3 w-3" />
            <span>Payment failed</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="h-3 w-3" />
            <span>Expired</span>
          </span>
        );
    }
  };

  const steps = [
    { label: 'Created', done: true, time: order.createdAt },
    {
      label: 'Payment started',
      done: true,
      time: order.createdAt,
    },
    {
      label: 'Paid',
      done: order.status === 'PAID' || order.status === 'FULFILLED',
      time: order.status === 'PAID' || order.status === 'FULFILLED' ? order.updatedAt : undefined,
    },
    {
      label: 'Fulfilled',
      done: order.status === 'FULFILLED',
      time: order.status === 'FULFILLED' ? order.updatedAt : undefined,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end transition-opacity duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col transform transition-transform duration-200 ease-out">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white font-mono">
                {order.id}
              </h2>
              {renderStatusBadge(order.status)}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Placed {formatRelativeTime(order.createdAt)} •{' '}
              <span title={order.createdAt}>{formatExactTime(order.createdAt)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Order Lifecycle Timeline */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Order Timeline
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {steps.map((step, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      step.done
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-1.5 leading-tight">
                    {step.label}
                  </span>
                  {step.time && (
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Items List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
              </h3>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {item.unit} • {formatPaise(item.pricePaise)} each
                      {item.substituteAllowed && (
                        <span className="ml-2 text-brand-600 dark:text-brand-400">
                          (Substitutes allowed)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatPaise(item.totalPaise)}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      qty: {item.quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Price Breakdown
            </h3>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Item Subtotal</span>
              <span className="font-mono tabular-nums">{formatPaise(order.breakdown.subtotalPaise)}</span>
            </div>
            {order.breakdown.discountPaise > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center space-x-1">
                  <Tag className="h-3 w-3" />
                  <span>Promo Discount ({order.appliedPromos.join(', ')})</span>
                </span>
                <span className="font-mono tabular-nums">-{formatPaise(order.breakdown.discountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Delivery Fee</span>
              <span className="font-mono tabular-nums">
                {order.breakdown.deliveryFeePaise === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">FREE</span>
                ) : (
                  formatPaise(order.breakdown.deliveryFeePaise)
                )}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Handling Fee</span>
              <span className="font-mono tabular-nums">{formatPaise(order.breakdown.handlingFeePaise)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>GST (5%)</span>
              <span className="font-mono tabular-nums">{formatPaise(order.breakdown.gstPaise)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-semibold text-slate-900 dark:text-white text-sm">
              <span>Total Amount</span>
              <span className="font-mono tabular-nums text-brand-600 dark:text-brand-400">
                {formatPaise(order.breakdown.totalPaise)}
              </span>
            </div>
          </div>

          {/* Delivery & Payment Metadata */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Delivery & Payment Info
            </h3>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-start space-x-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    PIN {order.location.pincode} • {order.location.area}, {order.location.city}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ETA: ~{order.location.etaMinutes} minutes
                    {order.deliverySlot && ` • Slot: ${order.deliverySlot}`}
                  </div>
                  {order.note && (
                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 italic">
                      Note: "{order.note}"
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <CreditCard className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div className="font-mono text-[11px] leading-tight space-y-0.5 text-slate-600 dark:text-slate-400">
                  <div>Razorpay Order: {order.razorpayOrderId}</div>
                  <div>Payment Status: {order.paymentStatus}</div>
                  <div className="truncate max-w-xs text-slate-400">
                    Token: {order.paymentSessionToken.slice(0, 24)}... (valid: {String(order.paymentSessionTokenValid)})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Raw JSON Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="flex items-center space-x-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>{showRawJson ? 'Hide raw JSON' : 'View raw JSON payload'}</span>
            </button>
            {showRawJson && (
              <pre className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-64">
                {JSON.stringify(order, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

