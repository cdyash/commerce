import React, { useState } from 'react';
import { Shield, KeyRound, AlertCircle, X } from 'lucide-react';
import { setAdminKey, getAdminKey } from '../api/client';

interface AdminKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: () => void;
}

export const AdminKeyModal: React.FC<AdminKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [keyInput, setKeyInput] = useState(getAdminKey());
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setError('Admin key cannot be empty.');
      return;
    }
    setAdminKey(keyInput.trim());
    setError('');
    onKeySaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Enter Admin Key
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Memory-only authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-2.5">
          <Shield className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            QuickCart Merchant API protects admin and telemetry endpoints with an{' '}
            <code className="font-mono text-brand-600 dark:text-brand-400">x-admin-key</code> header.
            Your key is kept <strong>in memory only</strong> and will never be written to localStorage or cookies.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Admin Key (from your .env file)
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setError('');
              }}
              placeholder="e.g. adminkey_supersecret_12345"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-mono"
              autoFocus
            />
            {error && (
              <div className="flex items-center space-x-1 mt-1 text-xs text-rose-500">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-sm shadow-brand-500/20"
            >
              Save Admin Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

