import React, { useState } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Play,
} from 'lucide-react';
import { AdminState } from '../types';
import { switchSpecVersion, resetStore, simulateWebhook } from '../api/client';
import { formatPaise } from '../utils/currency';

interface DemoControlsScreenProps {
  state: AdminState | null;
  onRefresh: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const DemoControlsScreen: React.FC<DemoControlsScreenProps> = ({
  state,
  onRefresh,
  onShowToast,
}) => {
  const currentVersion = state?.specVersion || 'v1';
  const pendingOrders = state?.orders.filter((o) => o.status === 'PENDING_PAYMENT') || [];

  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const specVersions = [
    {
      version: 'v1' as const,
      name: 'v1 (Baseline)',
      type: 'Safe' as const,
      description: 'Standard quick-commerce endpoints without order inspection.',
    },
    {
      version: 'v2' as const,
      name: 'v2 (Non-breaking)',
      type: 'Safe' as const,
      description: 'Adds optional substituteAllowed to cart, note to checkout, and GET /v1/orders/{orderId}.',
    },
    {
      version: 'v3' as const,
      name: 'v3 (Breaking)',
      type: 'Breaking' as const,
      description: 'Checkout now strictly REQUIRES deliverySlot ("asap" | "evening" | "tomorrow").',
    },
    {
      version: 'v4' as const,
      name: 'v4 (Breaking)',
      type: 'Breaking' as const,
      description: 'Removes POST /v1/cart/promo; replaces with POST /v1/cart/coupons.',
    },
  ];

  const handleVersionChange = async (ver: 'v1' | 'v2' | 'v3' | 'v4') => {
    try {
      await switchSpecVersion(ver);
      onShowToast(
        'success',
        `Switched to Spec ${ver}`,
        `OpenAPI specification and runtime request validation updated to ${ver}.`
      );
      onRefresh();
    } catch (err) {
      onShowToast('error', 'Spec switch failed', (err as Error).message);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetStore();
      setShowResetConfirm(false);
      onShowToast(
        'success',
        'Store Reset Complete',
        'Seeded products, pincodes, promos restored. Sessions and orders cleared.'
      );
      onRefresh();
    } catch (err) {
      onShowToast('error', 'Reset failed', (err as Error).message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSimulate = async (outcome: 'captured' | 'failed') => {
    if (!selectedOrder) {
      onShowToast('error', 'Select Order', 'Please pick a pending order to simulate payment.');
      return;
    }
    setIsSimulating(true);
    try {
      await simulateWebhook(selectedOrder, outcome);
      onShowToast(
        'success',
        outcome === 'captured' ? 'Payment Captured' : 'Payment Failed',
        `Simulated ${outcome === 'captured' ? 'success' : 'failure'} through cryptographic webhook pipeline.`
      );
      onRefresh();
    } catch (err) {
      onShowToast('error', 'Simulation failed', (err as Error).message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyOpenApi = () => {
    const url = `${window.location.origin}/openapi.json`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onShowToast('info', 'Link Copied', 'Copied /openapi.json URL to clipboard.');
  };

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Demo Controls & Spec Switcher
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Dynamically alter backend API schemas, reset seed data, and simulate webhook events.
        </p>
      </div>

      {/* Spec Version Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <SlidersHorizontal className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Active OpenAPI Specification Version
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyOpenApi}
              className="flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy /openapi.json'}</span>
            </button>
            <a
              href="/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Open raw OpenAPI 3.1 JSON"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {specVersions.map((spec) => {
            const isSelected = currentVersion === spec.version;
            return (
              <div
                key={spec.version}
                onClick={() => handleVersionChange(spec.version)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-950/20 ring-2 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    {spec.name}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      spec.type === 'Safe'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {spec.type}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {spec.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simulate Webhook Payment Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2.5">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Simulate Webhook Payment (Dev Tool)
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Executes signed Razorpay HMAC-SHA256 payloads through the exact same webhook handler without requiring a public ngrok tunnel.
        </p>

        {pendingOrders.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            No orders currently waiting for payment. Create an order via API or curl first.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Select Pending Order
              </label>
              <select
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Choose an order waiting for payment --</option>
                {pendingOrders.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.id} ({formatPaise(ord.breakdown.totalPaise)}) • {ord.items.length} items
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                disabled={!selectedOrder || isSimulating}
                onClick={() => handleSimulate('captured')}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Simulate Payment Captured (Success)</span>
              </button>

              <button
                disabled={!selectedOrder || isSimulating}
                onClick={() => handleSimulate('failed')}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Simulate Payment Failed</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Merchant Store */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <RotateCcw className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Reset Demo Store
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Restores products, promos, and pincodes to seed defaults; resets spec to v1; clears sessions & orders.
          </p>
        </div>

        <div>
          {showResetConfirm ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={isResetting}
                onClick={handleReset}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs"
              >
                Confirm Reset
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset demo data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
