import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Navigation, ScreenId } from './components/Navigation';
import { OverviewScreen } from './screens/OverviewScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { PaymentsScreen } from './screens/PaymentsScreen';
import { DemoControlsScreen } from './screens/DemoControlsScreen';
import { OrderDrawer } from './components/OrderDrawer';
import { AdminKeyModal } from './components/AdminKeyModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { AdminState, HealthStatus, Order } from './types';
import { fetchAdminState, fetchHealth, hasAdminKey } from './api/client';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [adminState, setAdminState] = useState<AdminState | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(!hasAdminKey());
  const [darkMode, setDarkMode] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isPollingRef = useRef(false);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, message?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadData = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const healthData = await fetchHealth();
      setHealth(healthData);
    } catch {
      // ignore transient health fetch error
    }

    if (hasAdminKey()) {
      try {
        const stateData = await fetchAdminState();
        setAdminState(stateData);

        // Keep selected order in sync if open
        if (selectedOrder) {
          const fresh = stateData.orders.find((o) => o.id === selectedOrder.id);
          if (fresh) setSelectedOrder(fresh);
        }
      } catch (err) {
        if ((err as Error).message === 'INVALID_ADMIN_KEY') {
          setIsKeyModalOpen(true);
        }
      }
    }

    isPollingRef.current = false;
  }, [selectedOrder]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 3-second polling (paused when document.hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return; // Pause polling when tab is hidden
      loadData();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Dark mode class on root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleOpenOrderById = (orderId: string) => {
    const found = adminState?.orders.find((o) => o.id === orderId);
    if (found) {
      setSelectedOrder(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-150">
      <Header
        health={health}
        specVersion={adminState?.specVersion || health?.specVersion || 'v1'}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        hasKey={hasAdminKey()}
      />

      <div className="flex-1 flex overflow-hidden">
        <Navigation
          currentScreen={currentScreen}
          onSelectScreen={setCurrentScreen}
          orderCount={adminState?.counts.ordersTotal}
          pendingOrderCount={adminState?.counts.ordersPending}
        />

        <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
          {currentScreen === 'overview' && (
            <OverviewScreen
              state={adminState}
              onNavigateToOrders={() => setCurrentScreen('orders')}
              onOpenOrder={handleOpenOrderById}
            />
          )}

          {currentScreen === 'orders' && (
            <OrdersScreen
              orders={adminState?.orders || []}
              onSelectOrder={setSelectedOrder}
            />
          )}

          {currentScreen === 'catalog' && <CatalogScreen />}

          {currentScreen === 'payments' && (
            <PaymentsScreen
              state={adminState}
              onOpenOrder={handleOpenOrderById}
            />
          )}

          {currentScreen === 'controls' && (
            <DemoControlsScreen
              state={adminState}
              onRefresh={loadData}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Order Detail Drawer */}
      <OrderDrawer
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      {/* Admin Key Prompt Modal */}
      <AdminKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeySaved={() => {
          loadData();
          showToast('success', 'Admin Key Configured', 'Stored in memory for this session.');
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

