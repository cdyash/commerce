import React, { useState, useEffect } from 'react';
import { Package, Search, AlertTriangle } from 'lucide-react';
import { Product } from '../types';
import { formatPaise } from '../utils/currency';
import { fetchAdminCatalog, hasAdminKey } from '../api/client';

export const CatalogScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasAdminKey()) {
      setLoading(false);
      return;
    }

    fetchAdminCatalog()
      .then((items) => {
        setProducts(items);
        const cats = Array.from(new Set(items.map((p: Product) => p.category))) as string[];
        setCategories(['All', ...cats]);
      })
      .catch((err) => console.error('Failed to load admin catalog:', err))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter((prod) => {
    if (selectedCategory !== 'All' && prod.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = prod.name.toLowerCase().includes(q);
      const matchTag = prod.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchTag) return false;
    }
    return true;
  });

  const renderStockPill = (inStock: boolean, maxPerOrder: number) => {
    if (!inStock) {
      return (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          Out of stock
        </span>
      );
    }
    if (maxPerOrder <= 2) {
      return (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Low limit (max {maxPerOrder})
        </span>
      );
    }
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        In stock
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Title & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Catalog Inventory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse seed products, categories, paise pricing, and stock limits.
          </p>
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, tags, or prompt injection..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 w-64"
          />
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
              selectedCategory === cat
                ? 'bg-brand-500 text-white border-brand-500 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-1/2" />
              <div className="h-8 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <Package className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-xs">No products found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => {
            const isInjectionFixture = prod.tags?.includes('injection-fixture');
            return (
              <div
                key={prod.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xs ${
                  isInjectionFixture
                    ? 'border-purple-300 dark:border-purple-800/70 bg-purple-50/20 dark:bg-purple-950/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      {prod.id}
                    </span>
                    {renderStockPill(prod.inStock, prod.maxPerOrder)}
                  </div>

                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                    {prod.name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>

                  {isInjectionFixture && (
                    <div className="mt-2.5 flex items-center space-x-1.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-900/30 px-2 py-1 rounded-lg">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Downstream Sanitizer Test Fixture</span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {prod.category}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {prod.unit}
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline justify-between">
                  <div>
                    <span className="text-base font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatPaise(prod.pricePaise)}
                    </span>
                    {prod.mrpPaise > prod.pricePaise && (
                      <span className="ml-1.5 text-xs text-slate-400 line-through tabular-nums">
                        {formatPaise(prod.mrpPaise)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    max {prod.maxPerOrder} / order
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
