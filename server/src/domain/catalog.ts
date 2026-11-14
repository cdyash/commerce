import { Product } from '../store/seedLoader.js';

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  inStock?: boolean;
  limit?: number;
  cursor?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePaise: number;
  mrpPaise: number;
  unit: string;
  inStock: boolean;
  maxPerOrder: number;
  tags: string[];
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  nextCursor: string | null;
  totalMatches: number;
}

export function searchCatalog(
  productsMap: Map<string, Product>,
  params: CatalogSearchParams
): CatalogSearchResult {
  const { q, category, inStock, limit = 20, cursor } = params;
  const safeLimit = Math.max(1, Math.min(50, limit));

  let offset = 0;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const parsed = parseInt(decoded, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        offset = parsed;
      }
    } catch {
      offset = 0;
    }
  }

  const queryTerm = q?.trim().toLowerCase();
  const categoryFilter = category?.trim().toLowerCase();

  const allProducts = Array.from(productsMap.values());

  const matched = allProducts.filter((product) => {
    // Category match
    if (categoryFilter && product.category.toLowerCase() !== categoryFilter) {
      return false;
    }

    // In stock filter
    if (inStock !== undefined && (product.stock > 0) !== inStock) {
      return false;
    }

    // Keyword search in name or tags
    if (queryTerm) {
      const inName = product.name.toLowerCase().includes(queryTerm);
      const inTags = product.tags.some((tag) => tag.toLowerCase().includes(queryTerm));
      if (!inName && !inTags) {
        return false;
      }
    }

    return true;
  });

  const slice = matched.slice(offset, offset + safeLimit);
  const nextOffset = offset + safeLimit;
  const nextCursor =
    nextOffset < matched.length ? Buffer.from(String(nextOffset)).toString('base64') : null;

  const items: CatalogItem[] = slice.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    pricePaise: p.pricePaise,
    mrpPaise: p.mrpPaise,
    unit: p.unit,
    inStock: p.stock > 0,
    maxPerOrder: p.maxPerOrder,
    tags: p.tags,
  }));

  return {
    items,
    nextCursor,
    totalMatches: matched.length,
  };
}

