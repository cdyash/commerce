import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Copy,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { AdminState } from '../types';
import { formatExactTime, formatRelativeTime } from '../utils/time';

interface PaymentsScreenProps {
  state: AdminState | null;
  onOpenOrder: (orderId: string) => void;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  state,
  onOpenOrder,
}) => {
  const webhookEvents =
    state?.recentEvents.filter((e) => e.type === 'webhook_received') || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Payments & Webhooks
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Cryptographically verified Razorpay webhook event stream.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Webhook className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Webhook Audit Feed ({webhookEvents.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            HMAC-SHA256 Timing-Safe
          </span>
        </div>

        {webhookEvents.length === 0 ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <CreditCard className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs">No payment webhook events recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {webhookEvents.map((evt) => {
              const details = evt.details || {};
              const isRejected = details.validSignature === false;
              const isDuplicate = details.duplicate === true;
              const orderId = (details.orderId as string) || undefined;
              const eventId = (details.eventId as string) || undefined;

              return (
                <div
                  key={evt.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                      {isRejected ? (
                        <XCircle className="h-4 w-4 text-rose-500" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-medium text-xs text-slate-900 dark:text-white">
                          {evt.description}
                        </span>

                        {isRejected ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center space-x-1">
                            <XCircle className="h-2.5 w-2.5" />
                            <span>Signature Rejected</span>
                          </span>
                        ) : isDuplicate ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center space-x-1">
                            <Copy className="h-2.5 w-2.5" />
                            <span>Ignored (duplicate)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>Verified</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                        {eventId && <span>event: {eventId}</span>}
                        {orderId && (
                          <button
                            onClick={() => onOpenOrder(orderId)}
                            className="text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                          >
                            <span>order: {orderId}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-slate-400 shrink-0 flex items-center sm:block space-x-2 sm:space-x-0">
                    <span title={evt.timestamp}>{formatRelativeTime(evt.timestamp)}</span>
                    <span className="hidden sm:block text-[10px] text-slate-400" title={evt.timestamp}>
                      {formatExactTime(evt.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
